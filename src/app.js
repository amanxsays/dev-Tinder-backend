const express= require('express');
const connectDB= require('./config/database')
const User= require('./models/user');
const validateSignupData = require('./utils/validation');
const bcrypt= require('bcrypt');

const app=express();

app.use(express.json()); 

app.post("/login", async (req,res)=>{
    try {
        const {emailId, password}=req.body;
        const user= await User.findOne({emailId: emailId});
        if(!user) throw new Error("Invalid credentials");
        const verifyPass= await bcrypt.compare(password, user.password);
        if(!verifyPass) throw new Error("Invalid credentials");
        else res.send("Login Successfully...🫂")
        
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

app.post("/signup", async (req,res)=>{
    try {
        //validate info
        validateSignupData(req);
        //encrypt password
        const { firstName, lastName, emailId, password}=req.body;
        const hashPass= await bcrypt.hash(password, 10);

        const user1= new User({firstName:firstName, lastName:lastName, emailId:emailId, password:hashPass});
        await user1.save();
        res.send("User Added Successfully");
    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
})

app.get("/feed", async (req,res)=>{
    const userEmail=req.body.emailId;
    try {
        const data=await User.find({emailId:userEmail});
        if(data.length==0) res.status(404).send("User Not Found");
        else res.send(data);
    } catch (error) {
        res.status(400).send("Something went wrong");
    }
})

app.delete("/user", async (req,res)=>{
    const userId=req.body.userId;
    try {
        await User.findByIdAndDelete(userId)
        res.send("User delete successfully");
    } catch (error) {
        res.status(400).send("Something went wrong");
    }
})

app.patch("/user/:userId", async (req,res)=>{
    const userId=req.params?.userId;
    const data=req.body;
    const allowedUpdate=["skills","photoUrl","firstName","lastName","age","password"]
    try {
        const isUpdateAllowed=Object.keys(data).every((k) => allowedUpdate.includes(k));
        if(!isUpdateAllowed) throw new Error("Update failed : some fields can't be updated");
        if(data.skills && data.skills.length>10) throw new Error("Skills should not exceed the count of 10");

        const updatedUser=await User.findByIdAndUpdate(userId, data, {
            returnDocument:'before',
            runValidators:true,
        })
        res.send("User Updated  successfully");
    } catch (error) {
        res.status(400).send("Something went wrong: "+error.message);
    }
})


connectDB().then(()=>{
    console.log("Connected To DB");
    app.listen(7777, ()=>{
    console.log("Server is listening");
})
}).catch((err)=>{
    console.error("Failed to connect to DB");
})

