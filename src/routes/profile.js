const express= require('express');
const { userAuth } = require('../middleware/auth');
const { validateEditProfileData } = require('../utils/validation');
const { enrichProfileWithStats } = require('../utils/fetchStats');
const bcrypt=require('bcrypt');
const axios = require('axios');
const User = require('../models/user');

const profileRouter=express.Router();

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
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) return res.status(404).send("User not found");
        const fullProfile = await enrichProfileWithStats(targetUser);
        if (req.user._id.toString() !== req.params.userId) {
            delete fullProfile.password;
            delete fullProfile.emailId;
        }
        res.json(fullProfile);
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