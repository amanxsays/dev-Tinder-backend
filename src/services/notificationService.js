const mongoose = require('mongoose');
const NotificationEvent = require('../models/notificationEvent');
const DAY_MS = 86400000;
const notificationsEnabled = () => process.env.PUSH_NOTIFICATIONS_ENABLED === 'true';

function notificationEvent(type, resourceId, recipientId, targetUserId, now = new Date()) {
    return { eventId: `${type}:${resourceId}`, recipientId, type, targetUserId,
        occurredAt: now, expiresAt: new Date(now.getTime() + DAY_MS) };
}

// A failed transaction saves neither the business operation nor its outbox event.
// No transactions are required for existing deployments with push disabled.
async function persistWithNotification(save, event, options = {}) {
    const enabled = options.enabled ?? notificationsEnabled();
    if (!enabled || !event) return save(null);
    const database = options.database || mongoose;
    const Events = options.Events || NotificationEvent;
    const session = await database.startSession();
    let result;
    try {
        await session.withTransaction(async () => {
            result = await save(session);
            await Events.create([typeof event === 'function' ? event(result) : event], { session });
        });
        return result;
    } finally { await session.endSession(); }
}
module.exports = { notificationsEnabled, notificationEvent, persistWithNotification };
