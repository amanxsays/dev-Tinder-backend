const express= require('express');
const { userAuth } = require('../middleware/auth');
const ConnectionRequest = require('../models/connectionRequests');
const userRouter= express.Router();
const User = require('../models/user')

const SAFE_DATA ="firstName lastName gender photoUrl age about  skills";

userRouter.get("/user/requests/received" , userAuth, async (req,res)=>{
    try {
        const loggedInUser=req.user;
        const pendingRequests=await ConnectionRequest.find({
            toUserId:loggedInUser._id,
            status:"interested"
        }).populate("fromUserId",SAFE_DATA)
        res.send(pendingRequests);
    }  catch (error) {
        res.status(400).send("Error: " +error.message);
    }
})

userRouter.get("/user/connections" , userAuth, async (req,res)=>{
    try {
        const loggedInUser=req.user;
        const connections=await ConnectionRequest.find({
            $or:[
                {toUserId:loggedInUser._id,status:"accepted"},
                {fromUserId:loggedInUser._id,status:"accepted"},
            ]
        }
        ).populate("fromUserId",SAFE_DATA).populate("toUserId",SAFE_DATA);
        
        const showableData=connections.map( key => ((key.fromUserId._id.toString()!==loggedInUser._id.toString()) ? key.fromUserId : key.toUserId));
        res.send(showableData);
    }  catch (error) {
        res.status(400).send("Error: " +error.message);
    }
})

userRouter.get("/user/feed" , userAuth, async (req,res)=>{
    try {
        const loggedInUser=req.user;

        const page=parseInt(req.query.page) || 1;
        let limit=parseInt(req.query.limit) || 10;
        limit= limit>50 ? 50 : limit;
        const skip=(page-1)*limit;

        const connections=await ConnectionRequest.find({
            $or:[{toUserId:loggedInUser._id},{fromUserId:loggedInUser._id}]
        }
        ).select("fromUserId  toUserId");

        const hideUsersFromFeed=new Set();
        connections.forEach( key => {
            hideUsersFromFeed.add(key.toUserId.toString());
            hideUsersFromFeed.add(key.fromUserId.toString());
        });
        const users= await User.find({
            $and:[
                {_id:{ $nin: Array.from(hideUsersFromFeed)}},
                {_id:{ $ne: loggedInUser._id}}
            ]
        }).select(SAFE_DATA).skip(skip).limit(limit);
        res.send(users);
    }  catch (error) {
        res.status(400).send("Error: " +error.message);
    }
})

module.exports=userRouter;