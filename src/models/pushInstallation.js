const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    installationId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true, select: false },
    secretHash: { type: String, required: true, select: false },
    bindingId: { type: String, required: true },
    boundAt: { type: Date, required: true },
    environment: { type: String, enum: ['development', 'production'], required: true },
    enabled: { type: Boolean, default: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
schema.index({ userId: 1, environment: 1, enabled: 1, expiresAt: 1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('PushInstallation', schema);
