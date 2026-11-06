const mongoose = require('mongoose');
const { Chat } = require('../models/chat');
const ConnectionRequest = require('../models/connectionRequests');
const { persistWithNotification, notificationEvent } = require('./notificationService');

function validateTarget(userId, targetUserId) {
    if (!mongoose.isObjectIdOrHexString(targetUserId) || String(userId) === String(targetUserId)) throw new Error('Invalid conversation.');
}
async function requireConnection(userId, targetUserId, Connections = ConnectionRequest) {
    validateTarget(userId, targetUserId);
    const connection = await Connections.findOne({ status: 'accepted', $or: [
        { fromUserId: userId, toUserId: targetUserId }, { fromUserId: targetUserId, toUserId: userId },
    ] });
    if (!connection) throw new Error('An accepted connection is required.');
}
const roomId = (userId, targetUserId) => [String(userId), String(targetUserId)].sort().join('_');

async function saveMessage(user, targetUserId, text, options = {}) {
    await requireConnection(user._id, targetUserId, options.Connections);
    if (typeof text !== 'string' || !text.trim() || text.length > 16000) throw new Error('Message must contain 1 to 16000 characters.');
    const Chats = options.Chats || Chat;
    const persist = options.persist || persistWithNotification;
    const messageId = new mongoose.Types.ObjectId();
    const createdAt = new Date();
    const message = { _id: messageId, senderId: user._id, text, createdAt, updatedAt: createdAt };
    await persist(async session => {
        let query = Chats.findOne({ participants: { $all: [user._id, targetUserId], $size: 2 } });
        if (session) query = query.session(session);
        let chat = await query;
        if (!chat) chat = new Chats({ participants: [user._id, targetUserId], messages: [] });
        chat.messages.push(message);
        await chat.save(session ? { session } : undefined);
        return chat;
    }, { ...notificationEvent('message', messageId, targetUserId, String(user._id), createdAt),
        senderName: [user.firstName, user.lastName].filter(Boolean).join(' ').slice(0, 80),
        messagePreview: text.trim().slice(0, 240) });
    return { _id: String(messageId), senderId: String(user._id), targetUserId: String(targetUserId),
        createdAt: createdAt.toISOString(), firstName: user.firstName, photoUrl: user.photoUrl || '', text };
}
module.exports = { validateTarget, requireConnection, roomId, saveMessage };
