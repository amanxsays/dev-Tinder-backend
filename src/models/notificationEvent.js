const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['message', 'connection_request'], required: true },
    targetUserId: { type: String },
    senderName: { type: String, maxlength: 80 },
    messagePreview: { type: String, maxlength: 240 },
    occurredAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    state: { type: String, enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    leaseOwner: String,
    deliveredBindings: { type: [String], default: [] },
    failureCode: String,
}, { timestamps: true });
schema.index({ state: 1, nextAttemptAt: 1, leaseUntil: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('NotificationEvent', schema);
