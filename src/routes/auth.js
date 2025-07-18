const express= require('express');
const User= require('../models/user');
const {validateSignupData} = require('../utils/validation');
const bcrypt=require('bcrypt');
const { sendEmail }= require("../utils/send-email");
const Otp = require('../models/otp');

const authRouter=express.Router();

authRouter.post("/signup", async (req,res)=>{
    try {
        validateSignupData(req);
        //encrypt password
        const { firstName, lastName, emailId, password, otp}=req.body;

        //otp verification
        const emailOfOtp=await Otp.findOne({emailId: emailId});
        
        
        if(otp!=emailOfOtp?.otp) throw new Error("Invalid Otp");
        await Otp.deleteOne({emailId: emailId});
        
        const photoUrl ="https://api.dicebear.com/9.x/fun-emoji/svg?seed="+(firstName+lastName).replaceAll(" ", "");
        const hashPass= await bcrypt.hash(password, 10);

        const user1= new User({firstName:firstName, lastName:lastName, emailId:emailId, password:hashPass, photoUrl:photoUrl});
        await user1.save();
        const token= await user1.getJWT();
        res.cookie("token", token , {expires: new Date(Date.now()+7*24*3600000)});
        sendEmail(emailId,"New account activity at DEVTINDER",`Congratulations ${firstName+" "+lastName} 👍🏻...  You have successfully registered ✅`);
        res.json({
            message:"User Added Successfully",
            data:user1
        });
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

authRouter.post("/otp", async (req,res)=>{
    try {
        //validate info
        validateSignupData(req);
        const {emailId} =req.body;
        const present=await User.findOne({emailId: emailId});
        if(present) throw new Error("Email already exists !");
        //generate otp and store
        const otpALreadyThere=await Otp.findOne({emailId: emailId});
        if(otpALreadyThere) res.status(402).send("OTP is ALready sent");
        const otpObj= new Otp({emailId: emailId, otp: Math.floor(100000 + Math.random() * 900000)});
        await otpObj.save();
        sendEmail(emailId,"Verify ur email",otpObj.otp);
        res.send("Otp sent to your email");
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

authRouter.post("/login", async (req,res)=>{
    try {
        const {emailId, password}=req.body;
        const user= await User.findOne({emailId: emailId});
        if(!user) throw new Error("Invalid credentials");
        const verifyPass= await user.validatePass(password);
        if(!verifyPass) throw new Error("Invalid credentials");
        else{
            //make a token and wrap inside cookie and send back by res
            const token= await user.getJWT();
            res.cookie("token", token , {expires: new Date(Date.now()+7*24*3600000)});
            res.json({
                message: user.firstName+" logged in Successfully...🫂",
                data:user
            });
        }
        
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

authRouter.post("/logout", async (req,res)=>{
    res.clearCookie("token");
    res.send("Logout Successfully");
})


module.exports = authRouter;
