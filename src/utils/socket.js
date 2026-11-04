const { Server } = require('socket.io');
const User = require('../models/user');
const { socketSession } = require('./authSession');
const { allowedOrigins } = require('./corsOptions');
const chatService = require('../services/chatService');

function initializeSocket(server, options = {}) {
    const io = options.io || new Server(server, {
        cors: { origin: allowedOrigins(process.env.FRONTEND_API_URL), credentials: true },
        allowRequest: (req, callback) => callback(null, !req.headers.origin || allowedOrigins(process.env.FRONTEND_API_URL).includes(req.headers.origin)),
    });
    const Users = options.Users || User;
    const service = options.chatService || chatService;
    io.use(async (socket, next) => {
        try {
            const claims = socketSession(socket.handshake);
            const user = await Users.findById(claims._id);
            if (!user) throw new Error('Invalid session');
            socket.data.user = user;
            socket.data.expiresAt = claims.exp * 1000;
            next();
        } catch { next(new Error('Authentication required.')); }
    });
    io.on('connection', socket => {
        const fresh = () => {
            if (Date.now() >= socket.data.expiresAt) { socket.disconnect(true); throw new Error('Session expired. Sign in again.'); }
        };
        const timer = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
        timer.unref?.();
        socket.on('joinChat', async (payload = {}, ack) => {
            try {
                fresh();
                const { targetUserId } = payload;
                await service.requireConnection(socket.data.user._id, targetUserId);
                fresh();
                await socket.join(service.roomId(socket.data.user._id, targetUserId));
                if (typeof ack === 'function') ack({ ok: true });
            } catch (error) { if (typeof ack === 'function') ack({ ok: false,
                error: /^Invalid|^An accepted|^Session/.test(error.message) ? error.message : 'Could not join this conversation.' }); }
        });
        socket.on('sendMessage', async (payload = {}, ack) => {
            try {
                fresh();
                const message = await service.saveMessage(socket.data.user, payload.targetUserId, payload.text);
                io.to(service.roomId(socket.data.user._id, payload.targetUserId)).emit('messageReceived', message);
                if (typeof ack === 'function') ack({ ok: true, message });
            } catch (error) {
                if (typeof ack === 'function') ack({ ok: false, error: /^Invalid|^Message|^An accepted|^Session/.test(error.message)
                    ? error.message : 'Could not save this message. Your draft is preserved.' });
            }
        });
        socket.on('disconnect', () => clearTimeout(timer));
    });
    return io;
}
module.exports = initializeSocket;
