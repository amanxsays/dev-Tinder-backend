const express= require('express');
const connectDB= require('./config/database')
const User= require('./models/user');
const validateSignupData = require('./utils/validation');
const { userAuth } = require('./middleware/auth')
const bcrypt= require('bcrypt');
const cookieParser= require('cookie-parser');

const app=express();

app.use(express.json()); 
app.use(cookieParser());

app.post("/login", async (req,res)=>{
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

