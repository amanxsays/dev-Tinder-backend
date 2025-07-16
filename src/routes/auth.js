const express= require('express');
const User= require('../models/user');
const {validateSignupData} = require('../utils/validation');
const bcrypt=require('bcrypt')

const authRouter=express.Router();

authRouter.post("/signup", async (req,res)=>{
    try {
        //validate info
        validateSignupData(req);
        //encrypt password
        const { firstName, lastName, emailId, password}=req.body;
        const photoUrl ="https://api.dicebear.com/9.x/fun-emoji/svg?seed="+firstName+lastName;
        const hashPass= await bcrypt.hash(password, 10);

        const user1= new User({firstName:firstName, lastName:lastName, emailId:emailId, password:hashPass, photoUrl:photoUrl});
        await user1.save();
        res.send("User Added Successfully");
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
