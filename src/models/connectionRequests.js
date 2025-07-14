const mongoose=require("mongoose");

const connectionRequestsSchema = new mongoose.Schema(
  {
    fromUserId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    toUserId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    status:{
        type: String,
        required: true,
        enum:{
            values:["ignored","interested","accepted","rejected"],
            message:'{VALUE} is incorrect status type !!' 
        }
    }
  },
  {timestamps: true}
);

connectionRequestsSchema.index({ fromUserId: 1 , toUserId: 1 });

connectionRequestsSchema.pre("save", function(next){
    const connRequest=this;
    if(connRequest.toUserId.equals(connRequest.fromUserId)) throw new Error("Can't send request to yourself.");
    next();
})

const ConnectionRequest= new mongoose.model(
    "ConnectionRequest",
    connectionRequestsSchema
)

module.exports= ConnectionRequest;