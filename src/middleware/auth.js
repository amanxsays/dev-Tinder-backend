const User= require('../models/user');
const jwt= require('jsonwebtoken');

const userAuth= async (req,res,next)=>{
    try {
        const cookies=req.cookies;
        const {token}=cookies;
        if(!token) throw new Error("Invalid Token");
        
        const decodeToken= await jwt.verify(token, "Aman's@Dev-Tinder07");
        const { _id }=decodeToken;

        const user= await User.findById(_id);
        if(!user) throw new Error("User Does Not Exist !!!!");

        req.user=user;
        next();

    } catch (error) {
        res.status(400).send("Error: " +error.message)
    }
}

module.exports = {userAuth};