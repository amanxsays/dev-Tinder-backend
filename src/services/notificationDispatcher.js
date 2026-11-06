const { randomUUID } = require('node:crypto');
const NotificationEvent = require('../models/notificationEvent');
const PushInstallation = require('../models/pushInstallation');
const { notificationsEnabled } = require('./notificationService');
const MAX_ATTEMPTS = 6;
const INVALID_TOKENS = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

function pushData(event, installation) {
    return { eventId: event.eventId, type: event.type, bindingId: installation.bindingId,
        ...(event.targetUserId ? { targetUserId: String(event.targetUserId) } : {}),
        ...(event.type === 'message' ? { senderName: String(event.senderName || '').slice(0, 80),
            messagePreview: String(event.messagePreview || '').slice(0, 240) } : {}),
        createdAt: new Date(event.occurredAt).toISOString(), expiresAt: new Date(event.expiresAt).toISOString() };
}
function firebaseSender() {
    const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const app = getApps().find(item => item.name === 'devtinder-push')
        || initializeApp({ credential: applicationDefault() }, 'devtinder-push');
    return message => getMessaging(app).send(message);
}

async function sendWithDeadline(send, message, timeoutMs = 20000) {
    let timer;
    try {
        return await Promise.race([send(message), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('notification_send_timeout')), timeoutMs);
            timer.unref?.();
        })]);
    } finally { clearTimeout(timer); }
}

async function deliverEvent(event, { Installations = PushInstallation, Events = NotificationEvent,
    send, environment = process.env.PUSH_ENVIRONMENT || 'production', now = () => new Date(), sendTimeoutMs = 20000 } = {}) {
    const installations = await Installations.find({ userId: event.recipientId, environment,
        enabled: true, expiresAt: { $gt: now() }, boundAt: { $lte: event.occurredAt } }).select('+token');
    let transientFailure = false;
    const delivered = new Set(event.deliveredBindings || []);
    for (const installation of installations) {
        const deliveryKey = installation.installationId + ':' + installation.bindingId;
        if (delivered.has(deliveryKey)) continue;
        const current = await Installations.findOne({ _id: installation._id, enabled: true,
            bindingId: installation.bindingId, token: installation.token, expiresAt: { $gt: now() } });
        if (!current) continue;
        try {
            const lease = await Events.updateOne({ _id: event._id, leaseOwner: event.leaseOwner },
                { $set: { leaseUntil: new Date(now().getTime() + 120000) } });
            if (lease && lease.matchedCount === 0) return false;
            await sendWithDeadline(send, { token: installation.token, data: pushData(event, installation), android: {
                priority: 'high', ttl: Math.max(0, Math.min(86400000, new Date(event.expiresAt) - now())) } }, sendTimeoutMs);
            await Events.updateOne({ _id: event._id, leaseOwner: event.leaseOwner },
                { $addToSet: { deliveredBindings: deliveryKey } });
            delivered.add(deliveryKey);
        } catch (error) {
            if (INVALID_TOKENS.has(error.code)) {
                await Installations.deleteOne({ _id: installation._id, bindingId: installation.bindingId, token: installation.token });
            } else transientFailure = true;
        }
    }
    return !transientFailure;
}

function startNotificationDispatcher(options = {}) {
    if (!(options.enabled ?? notificationsEnabled())) return () => {};
    const Events = options.Events || NotificationEvent;
    const owner = randomUUID();
    let stopped = false;
    let running = false;
    let sender;
    const tick = async () => {
        if (running || stopped) return;
        running = true;
        try {
            sender ||= options.send || firebaseSender();
            // A crash during the final attempt must not leave a permanent processing lease.
            await Events.updateMany({ state: 'processing', attempts: { $gte: MAX_ATTEMPTS }, leaseUntil: { $lt: new Date() } },
                { $set: { state: 'failed', failureCode: 'retry_limit', leaseUntil: null } });
            for (let index = 0; index < 10 && !stopped; index++) {
                const now = new Date();
                const event = await Events.findOneAndUpdate({ expiresAt: { $gt: now }, attempts: { $lt: MAX_ATTEMPTS },
                    $or: [{ state: 'pending', nextAttemptAt: { $lte: now } }, { state: 'processing', leaseUntil: { $lt: now } }] },
                { $set: { state: 'processing', leaseUntil: new Date(now.getTime() + 120000), leaseOwner: owner }, $inc: { attempts: 1 } },
                { new: true, sort: { createdAt: 1 } });
                if (!event) break;
                let done = false;
                try { done = await deliverEvent(event, { ...options, Events, send: sender }); }
                catch { /* Keep the durable event for a bounded retry. */ }
                await Events.updateOne({ _id: event._id, leaseOwner: owner }, { $set: {
                    state: done ? 'sent' : event.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', leaseUntil: null,
                    nextAttemptAt: new Date(Date.now() + Math.min(300000, 5000 * 2 ** (event.attempts - 1))),
                    failureCode: done ? '' : 'dispatch_unavailable',
                } });
            }
        } catch { console.warn('Notification dispatch unavailable; pending events remain queued.'); }
        finally { running = false; }
    };
    const timer = setInterval(tick, options.intervalMs || 5000);
    timer.unref();
    void tick();
    return () => { stopped = true; clearInterval(timer); };
}
module.exports = { pushData, deliverEvent, startNotificationDispatcher, sendWithDeadline, MAX_ATTEMPTS };
