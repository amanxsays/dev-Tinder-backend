const express= require('express');
const requestRouter=express.Router();
const { userAuth }= require('../middleware/auth');
const ConnectionRequest= require('../models/connectionRequests');
const User = require('../models/user');

requestRouter.post("/request/send/:status/:toUserId", userAuth, async (req,res) => {
    try {
        const toUserId=req.params.toUserId;
        const fromUserId=req.user._id;
        const status=req.params.status;
        const toUser=await User.findById(toUserId)
        if(! toUser) throw new Error("User does not exist ⚠️");
        if(!["interested","ignored"].includes(status)) throw new Error("Invalid status type : "+status);
        const existingRequest=await ConnectionRequest.findOne({
            $or: [
                { fromUserId: fromUserId , toUserId: toUserId},
                { fromUserId: toUserId , toUserId: fromUserId}
            ]
        })
        if(existingRequest) throw new Error("Connection Request already present !!");
        const data=new ConnectionRequest({toUserId:toUserId ,fromUserId:fromUserId, status:status});
        await data.save();
        res.send(req.user.firstName +(status=="interested"?" is ":" ")+status+(status=="interested"?" in ":" ")+ toUser.firstName);
    } catch (error) {
        res.status(400).send("Error: " +error.message);
    }
})

module.exports = requestRouter;