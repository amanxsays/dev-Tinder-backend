const { createHash, createHmac } = require('node:crypto');

function serviceAssertion(userId, query, { secret = process.env.AI_GATEWAY_SECRET, now = Date.now } = {}) {
    if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw new Error('AI gateway is not configured.');
    const timestamp = String(Math.floor(now() / 1000));
    const digest = createHash('sha256').update(query, 'utf8').digest('hex');
    const canonical = `POST\n/api/chat/stream\n${userId}\n${timestamp}\n${digest}`;
    return { 'X-DevTinder-Timestamp': timestamp, 'X-DevTinder-User': String(userId),
        'X-DevTinder-Signature': createHmac('sha256', secret).update(canonical, 'utf8').digest('hex') };
}
module.exports = { serviceAssertion };
