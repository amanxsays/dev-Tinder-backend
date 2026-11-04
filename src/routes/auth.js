const express= require('express');
const User= require('../models/user');
const {validateSignupData} = require('../utils/validation');
const { sendEmail }= require("../utils/send-email");
const Otp = require('../models/otp');
const otpTemplate= require("../utils/templates/otpTemplate");
const { sessionCookieOptions } = require('../utils/sessionPolicy');
const authService = require('../services/authService');
const { userDto } = require('../utils/userDto');

const authRouter=express.Router();

authRouter.post('/signup', async (req, res) => {
    try {
        const user = await authService.signup(req.body || {});
        res.cookie('token', await user.getJWT(), sessionCookieOptions());
        res.json({ message: 'User Added Successfully', data: userDto(user) });
    } catch { res.status(400).send('Error: Could not create account. Check your details and OTP.'); }
});

authRouter.post("/otp", async (req,res)=>{
    try {
        //validate info
        validateSignupData(req);
        const {emailId} =req.body;
        const present=await User.findOne({emailId: emailId});
        if(present) throw new Error("Email already exists !");
        //generate otp and store
        const otpALreadyThere=await Otp.findOne({emailId: emailId});
        if(otpALreadyThere) return res.status(402).json({message: "OTP is ALready sent", data: otpALreadyThere.createdAt});
        const otpObj= new Otp({emailId: emailId, otp: Math.floor(100000 + Math.random() * 900000)});
        await otpObj.save();
        try {
            await sendEmail(emailId,"Otp Verification of your email on DevTinder","",otpTemplate(otpObj.otp));
        } catch (error) {
            await Otp.findByIdAndDelete(otpObj._id); 
            throw new Error("Email service is blocked. Please click Resend.");
        }
        res.json({message:`Otp sent to your email`, data:otpObj.createdAt});
    } catch (error) {
        res.status(400).send("Error: " +error.message || error.data.message);

    }
})

authRouter.post('/login', async (req, res) => {
    try {
        const user = await authService.login(req.body || {});
        res.cookie('token', await user.getJWT(), sessionCookieOptions());
        res.json({ message: user.firstName + ' logged in successfully.', data: userDto(user) });
    } catch { res.status(400).send('Error: Invalid credentials'); }
});

authRouter.post("/logout", async (req,res)=>{
    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.send("Logout Successfully");
})


module.exports = authRouter;
