const express= require('express');
const fs = require('fs');
const path = require('path');
const { userAuth } = require('../middleware/auth');
const { validateEditProfileData } = require('../utils/validation');
const { enrichProfileWithStats } = require('../utils/fetchStats');
const ConnectionRequest = require("../models/connectionRequests");
const bcrypt=require('bcrypt');
const User = require('../models/user');
const { randomUUID } = require('node:crypto');
const { resumeVersionFilter, createResumeUpdate, notifyResumeService, sourceMatchesCurrentResume } = require('../utils/resumeLifecycle');

const profileRouter=express.Router();
const { cloudinary } = require("../utils/resumeUpload");

profileRouter.get("/profile/view", userAuth, async (req,res)=>{
    try {
        const fullProfile = await enrichProfileWithStats(req.user);
        res.send(fullProfile);
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
});

profileRouter.get("/profile/view/:userId", userAuth, async (req, res) => {
    try {
        const loggedInUser=req.user;
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).send("User not found");
        const finalProfile = await enrichProfileWithStats(targetUser);

        const connection = await ConnectionRequest.findOne({
            $or: [
                { fromUserId: loggedInUser._id, toUserId: targetUser._id },
                { fromUserId: targetUser._id, toUserId: loggedInUser._id }
            ]
        });

        finalProfile.connectionStatus = connection ? connection.status : null;

        if (loggedInUser._id.toString() !== req.params.userId) {
            delete finalProfile.password;
            delete finalProfile.emailId;
        }
        res.json(finalProfile);
    } catch (error) {
        res.status(400).send("Error: " + error.message);
    }
});

profileRouter.patch("/profile/edit", userAuth, async (req,res)=>{
    try {
       validateEditProfileData(req);
       const loggedInUser=req.user;
       Object.keys(req.body).forEach((key) => (loggedInUser[key]=req.body[key]));
       await loggedInUser.save();
       res.json({
        message:`${loggedInUser.firstName} ! Profile updated ✅`,
        data:loggedInUser
       })
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})


// GET a signed payload so the browser can upload the resume straight to Cloudinary
profileRouter.get("/profile/resume/upload-signature", userAuth, (req, res) => {
    try {
        const timestamp = Math.round(Date.now() / 1000);
        // Raw assets need the file extension in their public ID.
        const publicId = `${req.user._id}-${randomUUID()}.pdf`;
        const folder = "devtinder/resumes";

        const signature = cloudinary.utils.api_sign_request(
            { folder, public_id: publicId, timestamp },
            process.env.CLOUDINARY_API_SECRET
        );

        res.json({
            timestamp,
            signature,
            publicId,
            folder,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        });
    } catch (err) {
        res.status(500).json({ message: "ERROR: " + err.message });
    }
});

// GET a signed payload so the browser can delete the previous resume from Cloudinary
profileRouter.get("/profile/resume/destroy-signature", userAuth, (req, res) => {
    try {
        const publicId = req.user.resumePublicId;
        if (!publicId) {
            return res.status(400).json({ message: "No existing resume to delete." });
        }

        const timestamp = Math.round(Date.now() / 1000);
        const signature = cloudinary.utils.api_sign_request(
            { public_id: publicId, timestamp },
            process.env.CLOUDINARY_API_SECRET
        );

        res.json({
            timestamp,
            signature,
            publicId,
            apiKey: process.env.CLOUDINARY_API_KEY,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        });
    } catch (err) {
        res.status(500).json({ message: "ERROR: " + err.message });
    }
});

async function retireResume(previous, current) {
    const tasks = [notifyResumeService(current)];
    if (previous.resumePublicId && previous.resumePublicId !== current.resumePublicId) {
        tasks.push(cloudinary.uploader.destroy(previous.resumePublicId, { resource_type: 'raw', invalidate: true }));
    }
    const results = await Promise.allSettled(tasks);
    results.forEach(result => {
        if (result.status === 'rejected') console.error('Resume background task failed:', result.reason.message);
    });
}

// Save first. Cleanup must never destroy the previous file if this update fails.
profileRouter.patch("/profile/resume", userAuth, async (req, res) => {
    try {
        let update;
        try { update = createResumeUpdate(req.body); }
        catch (error) { return res.status(400).json({ message: error.message }); }
        if (!update.resumePublicId.startsWith(`devtinder/resumes/${req.user._id}-`)) {
            return res.status(400).json({ message: 'Invalid resume upload. Please upload the PDF again.' });
        }
        const uploadUrl = new URL(update.resumeUrl);
        if (uploadUrl.hostname !== 'res.cloudinary.com'
            || !decodeURIComponent(uploadUrl.pathname).endsWith('/' + update.resumePublicId)
            || (process.env.CLOUDINARY_CLOUD_NAME
                && !uploadUrl.pathname.startsWith(`/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/`))) {
            return res.status(400).json({ message: 'Resume URL does not match your uploaded file.' });
        }
        const loggedInUser = await User.findOneAndUpdate(resumeVersionFilter(req.user),
            { $set: update }, { new: true, runValidators: true });
        if (!loggedInUser) {
            return res.status(409).json({ message: 'Your resume changed during upload. Refresh and try again.' });
        }
        void retireResume(req.user, loggedInUser);
        res.json({
            message: "Resume uploaded successfully!",
            data: loggedInUser,
        });
    } catch (err) {
        res.status(500).json({ message: "ERROR: " + err.message });
    }
});

profileRouter.delete('/profile/resume', userAuth, async (req, res) => {
    try {
        const user = await User.findOneAndUpdate(resumeVersionFilter(req.user),
            { $unset: { resumeUrl: '', resumeFileName: '', resumePublicId: '', resumeDocumentId: '' } },
            { new: true });
        if (!user) return res.status(409).json({ message: 'Your resume changed. Refresh and try again.' });
        void retireResume(req.user, user);
        res.json({ message: 'Resume removed successfully!', data: user });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Recheck saved chat citations without making any AI calls.
profileRouter.post('/profile/resume/active-sources', userAuth, async (req, res) => {
    try {
        const sources = req.body.sources;
        if (!Array.isArray(sources) || sources.length > 100
            || sources.some(source => !source || !User.base.isValidObjectId(source.candidateId))) {
            return res.status(400).json({ message: 'Invalid resume sources.' });
        }
        const users = await User.find({ _id: { $in: sources.map(source => source.candidateId) } })
            .select('resumeUrl resumeFileName resumeDocumentId').lean();
        const byId = new Map(users.map(user => [user._id.toString(), user]));
        res.json({ sources: sources.filter(source => sourceMatchesCurrentResume(source, byId.get(source.candidateId)))
            .map(source => ({ documentId: source.documentId, candidateId: source.candidateId,
                fileName: byId.get(source.candidateId).resumeFileName, fileUrl: byId.get(source.candidateId).resumeUrl })) });
    } catch (error) { res.status(500).json({ message: 'Could not check current resumes.' }); }
});

profileRouter.patch("/profile/password", userAuth, async (req,res)=>{
    const { currentPassword, newPassword}=req.body;
    try {
        const loggedInUser=req.user;
        const verifyPass= await loggedInUser.validatePass(currentPassword);
        if(!verifyPass) throw new Error("Invalid current Password");
        else{
            loggedInUser.password=await bcrypt.hash(newPassword, 10);
            await loggedInUser.save();
            res.send("Password Updated successfully 🌸");
        }
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

module.exports = profileRouter;
