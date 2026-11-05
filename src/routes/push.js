const express = require('express');
const { createHash, timingSafeEqual, randomUUID } = require('node:crypto');
const { userAuth } = require('../middleware/auth');
const PushInstallation = require('../models/pushInstallation');
const LIFETIME_MS = 30 * 86400000;
const idPattern = /^[A-Za-z0-9_-]{16,128}$/;
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
const validToken = value => typeof value === 'string' && value.length >= 20 && value.length <= 4096 && !/\s/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
function hasSecret(record, secret) {
    if (!validSecret(secret) || !/^[a-f\d]{64}$/.test(record?.secretHash || '')) return false;
    return timingSafeEqual(Buffer.from(record.secretHash, 'hex'), Buffer.from(hash(secret), 'hex'));
}

function createPushRouter({ Installations = PushInstallation, authenticate = userAuth, now = () => new Date() } = {}) {
    const router = express.Router();
    router.use('/push', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.put('/push/installations/:installationId', authenticate, async (req, res) => {
        const { installationId } = req.params;
        const { token, installationSecret, environment, platform } = req.body || {};
        if (!idPattern.test(installationId) || !validToken(token) || !validSecret(installationSecret)
            || platform !== 'android' || !['development', 'production'].includes(environment)) {
            return res.status(400).json({ message: 'Invalid device registration.' });
        }
        try {
            // Unique indexes are part of the ownership guarantee, including immediately after startup.
            if (Installations.init) await Installations.init();
            const existing = await Installations.findOne({ installationId }).select('+secretHash');
            if (existing && !hasSecret(existing, installationSecret)) return res.status(403).json({ message: 'Invalid installation proof.' });
            const currentTime = now();
            const sameBinding = existing && existing.enabled && String(existing.userId) === String(req.user._id)
                && existing.environment === environment && existing.expiresAt > currentTime;
            const values = { token, userId: req.user._id, secretHash: hash(installationSecret), environment,
                enabled: true, expiresAt: new Date(currentTime.getTime() + LIFETIME_MS),
                bindingId: sameBinding ? existing.bindingId : randomUUID(),
                boundAt: sameBinding ? existing.boundAt : currentTime };
            // Atomic proof comparison prevents a concurrent claim from overwriting a binding.
            const saved = existing
                ? await Installations.findOneAndUpdate({ installationId, secretHash: existing.secretHash, bindingId: existing.bindingId },
                    { $set: values }, { new: true, runValidators: true })
                : await Installations.create({ installationId, ...values });
            if (!saved) return res.status(409).json({ message: 'Device registration changed. Try again.' });
            res.json({ bindingId: saved.bindingId, expiresAt: saved.expiresAt });
        } catch (error) {
            res.status(error.code === 11000 ? 409 : 503).json({ message: 'Could not register this device. Try again.' });
        }
    });

    async function prove(req, res) {
        if (!idPattern.test(req.params.installationId)) { res.status(400).json({ message: 'Invalid installation.' }); return null; }
        const record = await Installations.findOne({ installationId: req.params.installationId }).select('+secretHash');
        if (!record || !hasSecret(record, req.headers['x-installation-secret'])) {
            res.status(403).json({ message: 'Invalid installation proof.' }); return null;
        }
        if (req.headers['x-installation-binding'] && req.headers['x-installation-binding'] !== record.bindingId) {
            res.status(409).json({ message: 'Installation binding changed.' }); return null;
        }
        return record;
    }
    router.put('/push/installations/:installationId/token', async (req, res) => {
        if (!validToken(req.body?.token)) return res.status(400).json({ message: 'Invalid registration token.' });
        try {
            const record = await prove(req, res);
            if (!record) return;
            if (!record.enabled || record.expiresAt <= now()) return res.status(410).json({ message: 'Sign in to renew notifications.' });
            await Installations.updateOne({ _id: record._id, secretHash: record.secretHash, bindingId: record.bindingId },
                { $set: { token: req.body.token } }, { runValidators: true });
            res.json({ bindingId: record.bindingId, expiresAt: record.expiresAt });
        } catch (error) { res.status(error.code === 11000 ? 409 : 503).json({ message: 'Could not rotate this token.' }); }
    });
    router.delete('/push/installations/:installationId', async (req, res) => {
        try {
            const record = await prove(req, res);
            if (!record) return;
            await Installations.updateOne({ _id: record._id, secretHash: record.secretHash, bindingId: record.bindingId }, { $set: { enabled: false } });
            res.status(204).end();
        } catch { res.status(503).json({ message: 'Could not revoke this installation.' }); }
    });
    return router;
}
module.exports = createPushRouter();
module.exports.createPushRouter = createPushRouter;
module.exports.hasSecret = hasSecret;
module.exports.hash = hash;
