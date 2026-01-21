const socket = require("socket.io");
const { Chat } = require("../models/chat");
const ConnectionRequest = require("../models/connectionRequests");

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "https://dev-tinder-frontend-production.up.railway.app",
    },
  });

  io.on("connection", (socket) => {
    //handle events
    socket.on("joinChat", async ({userId, targetUserId}) => {
        const connection= await ConnectionRequest.findOne({$or:[
          {fromUserId:userId, toUserId:targetUserId},
          {fromUserId:targetUserId, toUserId:userId}
        ]})
        if(connection?.status!="accepted") return;
        const roomId = [userId, targetUserId].sort().join("_");
        socket.join(roomId);
    });
    socket.on("sendMessage", async ({firstName, userId, targetUserId, text, photoUrl}) => {
        //create that same room user id and emit the message there
        const roomId = [userId, targetUserId].sort().join("_");
        //save message to my db
        try {
          let chat=await Chat.findOne({participants:{ $all: [userId, targetUserId]}});
          if(!chat){
            chat= new Chat({
              participants:[userId, targetUserId],
              messages: []
            })
          }
          chat.messages.push({
            senderId: userId,
            text
          })
          await chat.save();

        } catch (error) {
          console.error(error);
        }

        io.to(roomId).emit("messageReceived",{firstName,text,photoUrl});
    });
    socket.on("disconnect", () => {});
  });
};

module.exports = initializeSocket;
