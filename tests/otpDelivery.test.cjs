const test = require('node:test');
const assert = require('node:assert/strict');
const { requestOtp, validOtp } = require('../src/services/otpService');
const { createEmailSender } = require('../src/utils/send-email');
const body = { firstName: 'Riya', lastName: 'Fixture', emailId: ' RIYA@EXAMPLE.TEST ', password: 'Fixture-Strong#123' };
const time = Date.parse('2026-11-06T00:00:00Z');
function fixture(previous = null) {
    let record = previous, sends = 0;
    class Codes {
        constructor(data) { Object.assign(this, data, { _id: 'new-code' }); }
        async save() { record = this; }
        static async findOne() { return record; }
        static async deleteOne(query) { if (record?._id === query._id) record = null; }
        static async updateOne(query, update) { if (record?._id === query._id) Object.assign(record, update.$set); }
    }
    return { Codes, Users: { findOne: async query => { assert.equal(query.emailId, 'riya@example.test'); return null; } },
        send: async to => { assert.equal(to, 'riya@example.test'); sends++; }, now: () => time,
        record: () => record, sends: () => sends };
}
test('OTP advances only after mail acceptance, normalizes email and never returns the code', async () => {
    const f = fixture(); const response = await requestOtp(body, f);
    assert.equal(f.sends(), 1); assert.equal(f.record().deliveryState, 'sent');
    assert.match(f.record().otp, /^\d{6}$/); assert.equal(response.otp, undefined);
    assert.equal(new Date(response.expiresAt) - new Date(response.sentAt), 300000);
    await assert.rejects(requestOtp(body, f), e => e.code === 'OTP_ACTIVE' && e.status === 429);
    assert.equal(f.sends(), 1);
});
test('mail failure removes pending code, returns 503 and permits a fresh attempt', async () => {
    const f = fixture(); await assert.rejects(requestOtp(body, { ...f, send: async () => { throw new Error('secret provider payload'); } }),
        e => e.status === 503 && !e.message.includes('secret'));
    assert.equal(f.record(), null); await requestOtp(body, f); assert.equal(f.sends(), 1);
});
test('resend replaces an older code without waiting for Mongo TTL; pending requests never claim delivery', async () => {
    const f = fixture({ _id: 'old', createdAt: new Date(time - 130000), otp: '123456' });
    await requestOtp(body, f); assert.equal(f.record()._id, 'new-code');
    const pending = fixture({ _id: 'pending', createdAt: new Date(time), deliveryState: 'pending' });
    await assert.rejects(requestOtp(body, pending), e => e.code === 'OTP_PENDING'); assert.equal(pending.sends(), 0);
});
test('verification rejects expired, future, malformed and unsent codes independently of Mongo TTL', () => {
    const record = { otp: '123456', createdAt: new Date(time - 299999) };
    assert.equal(validOtp(record, '123456', time), true);
    assert.equal(validOtp(record, '654321', time), false);
    assert.equal(validOtp({ ...record, createdAt: new Date(time - 300000) }, '123456', time), false);
    assert.equal(validOtp({ ...record, createdAt: new Date(time + 1) }, '123456', time), false);
    assert.equal(validOtp({ ...record, deliveryState: 'pending' }, '123456', time), false);
});
test('Brevo uses HTTPS and a verified sender configuration, with a bounded timeout', async () => {
    let captured;
    const send = createEmailSender({ env: { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'fixture-key', EMAIL_FROM: 'sender@example.test' },
        post: async (...args) => { captured = args; return { data: { messageId: 'fixture-accepted' } }; } });
    await send('recipient@example.test', 'Verify', '', '<p>fixture</p>');
    assert.equal(captured[0], 'https://api.brevo.com/v3/smtp/email');
    assert.equal(captured[1].sender.email, 'sender@example.test'); assert.equal(captured[2].timeout, 20000);
    const unavailable = createEmailSender({ env: { EMAIL_PROVIDER: 'brevo' }, post: async () => assert.fail('must not send') });
    await assert.rejects(unavailable('recipient@example.test', 'Verify', '', ''), e => e.code === 'EMAIL_CONFIGURATION');
});

test('mail diagnostic reasons distinguish IP, key and scope failures without exposing raw responses', () => {
    const { emailFailureReason } = require('../src/utils/send-email');
    const error = (status, message) => ({ response: { status, data: { message } } });
    assert.equal(emailFailureReason(error(401, 'We have detected you are using an unrecognised IP address')), 'IP_NOT_AUTHORIZED');
    assert.equal(emailFailureReason(error(401, 'Key not found')), 'API_KEY_REJECTED');
    assert.equal(emailFailureReason(error(403, 'Permission denied for this scope')), 'PERMISSION_DENIED');
    assert.equal(emailFailureReason(error(401, 'private-key-and-email-fixture')), 'AUTHENTICATION_REJECTED');
    assert.equal(emailFailureReason(error(400, 'Sender is not verified')), 'SENDER_NOT_AUTHORIZED');
});
