const express = require("express");
const { userAuth } = require("../middleware/auth");
const { Chat } = require("../models/chat");
const { requireConnection } = require('../services/chatService');

const chatRouter = express.Router();

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;

  try {
    await requireConnection(userId, targetUserId);
    let chat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] },
    }).populate({
        path:"messages.senderId",
        select:"firstName photoUrl"
    });
    if (!chat) {
      chat = new Chat({
        participants: [userId, targetUserId],
        messages: [],
      })
      await chat.save();
    }
    res.json(chat);
  } catch (error) {
    res.status(/Invalid|accepted connection/.test(error.message) ? 403 : 503)
      .json({ message: /Invalid|accepted connection/.test(error.message) ? error.message : 'Could not load this conversation.' });
  }
});

module.exports = chatRouter;
