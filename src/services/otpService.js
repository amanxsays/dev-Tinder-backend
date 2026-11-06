const { randomInt } = require('node:crypto');
const User = require('../models/user');
const Otp = require('../models/otp');
const { validateSignupData } = require('../utils/validation');
const { sendEmail } = require('../utils/send-email');
const otpTemplate = require('../utils/templates/otpTemplate');
const OTP_TTL_MS = 300000;
const RESEND_MS = 120000;

function failure(status, code, message, details = {}) {
    return Object.assign(new Error(message), { status, code, details });
}
async function requestOtp(body, { Users = User, Codes = Otp, send = sendEmail, now = Date.now } = {}) {
    const normalized = { ...body, emailId: typeof body.emailId === 'string' ? body.emailId.trim().toLowerCase() : '' };
    try { validateSignupData({ body: normalized }); }
    catch { throw failure(400, 'INVALID_SIGNUP', 'Check your name, email address and password. Use a strong password.'); }
    const emailId = normalized.emailId;
    if (await Users.findOne({ emailId })) throw failure(409, 'ACCOUNT_EXISTS', 'An account already uses this email. Choose Log in.');
    const time = now();
    const previous = await Codes.findOne({ emailId });
    if (previous) {
        const elapsed = time - new Date(previous.createdAt).getTime();
        if (elapsed >= 0 && elapsed < RESEND_MS && previous.deliveryState === 'pending')
            throw failure(429, 'OTP_PENDING', 'Your code is being sent. Please wait before retrying.');
        if (elapsed >= 0 && elapsed < RESEND_MS) throw failure(429, 'OTP_ACTIVE', 'A code was already sent. Check your inbox or wait before resending.',
            { sentAt: previous.createdAt, retryAfterSeconds: Math.ceil((RESEND_MS - elapsed) / 1000) });
        await Codes.deleteOne({ _id: previous._id });
    }
    const code = new Codes({ emailId, otp: String(randomInt(100000, 1000000)), deliveryState: 'pending', createdAt: new Date(time) });
    try { await code.save(); }
    catch (error) {
        if (error.code === 11000) throw failure(429, 'OTP_PENDING', 'A verification request is already in progress. Please wait before retrying.');
        throw error;
    }
    try { await send(emailId, 'Verify your DevTinder email', '', otpTemplate(code.otp)); }
    catch {
        await Codes.deleteOne({ _id: code._id });
        throw failure(503, 'EMAIL_UNAVAILABLE', 'We could not send your verification code. Please try again later.');
    }
    await Codes.updateOne({ _id: code._id }, { $set: { deliveryState: 'sent' } });
    return { message: 'Verification code sent. Check your inbox and spam folder.', sentAt: code.createdAt,
        expiresAt: new Date(time + OTP_TTL_MS), retryAfterSeconds: RESEND_MS / 1000 };
}
function validOtp(record, value, now = Date.now()) {
    const created = new Date(record?.createdAt).getTime();
    return Boolean(record && record.deliveryState !== 'pending' && Number.isFinite(created) && created <= now
        && now - created < OTP_TTL_MS && /^\d{6}$/.test(String(value).trim()) && String(value).trim() === String(record.otp));
}
module.exports = { requestOtp, validOtp, OTP_TTL_MS, RESEND_MS };
