const express= require('express');
const { userAuth } = require('../middleware/auth');
const { validateEditProfileData } = require('../utils/validation');
const bcrypt=require('bcrypt');

const profileRouter=express.Router();

profileRouter.get("/profile/view", userAuth, async (req,res)=>{
    try {
        const user= req.user;
        res.send(user);

    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

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