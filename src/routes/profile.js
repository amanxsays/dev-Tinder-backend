const express= require('express');
const fs = require('fs');
const path = require('path');
const { userAuth } = require('../middleware/auth');
const { validateEditProfileData } = require('../utils/validation');
const { enrichProfileWithStats } = require('../utils/fetchStats');
const ConnectionRequest = require("../models/connectionRequests");
const bcrypt=require('bcrypt');
const User = require('../models/user');

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
        const publicId = `${req.user._id}-${Date.now()}`;
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

// PATCH endpoint to save resume details once the browser has uploaded directly to Cloudinary
profileRouter.patch("/profile/resume", userAuth, async (req, res) => {
    try {
        const { resumeUrl, resumeFileName, resumePublicId } = req.body;
        if (!resumeUrl || !resumeFileName || !resumePublicId) {
            return res.status(400).json({ message: "Missing resume details." });
        }

        const loggedInUser = req.user;
        loggedInUser.resumeUrl = resumeUrl;
        loggedInUser.resumeFileName = resumeFileName;
        loggedInUser.resumePublicId = resumePublicId;
        await loggedInUser.save();

        // Tell the Java backend to process the resume in the background
        try {
            fetch("http://localhost:8080/api/ingestion/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileUrl: resumeUrl,
                    candidateId: loggedInUser._id.toString(),
                    fileName: resumeFileName
                })
            }).catch(err => console.error("Java ingestion failed:", err.message));
        } catch (err) {
            console.error("Fetch error:", err.message);
        }

        res.json({
            message: "Resume uploaded successfully!",
            data: loggedInUser,
        });
    } catch (err) {
        res.status(500).json({ message: "ERROR: " + err.message });
    }
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