const express= require('express');
const connectDB= require('./config/database')
const User= require('./models/user');
const validateSignupData = require('./utils/validation');
const { userAuth } = require('./middleware/auth')
const bcrypt= require('bcrypt');
const jwt= require('jsonwebtoken');
const cookieParser= require('cookie-parser');

const app=express();

app.use(express.json()); 
app.use(cookieParser());

app.post("/login", async (req,res)=>{
    try {
        const {emailId, password}=req.body;
        const user= await User.findOne({emailId: emailId});
        if(!user) throw new Error("Invalid credentials");
        const verifyPass= await bcrypt.compare(password, user.password);
        if(!verifyPass) throw new Error("Invalid credentials");
        else{
            //make a token and wrap inside cookie and send back by res
            const token= await jwt.sign({_id: user._id}, "Aman's@Dev-Tinder07")
            res.cookie("token", token);
            res.send("Login Successfully...🫂");
        }
        
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

app.get("/profile", userAuth, async (req,res)=>{
    try {
        const user= req.user;
        res.send(user);

    } catch (error) {
        res.status(400).send("Error: " +error.message)
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

