const axios = require('axios');
const validator = require('validator');

function createEmailSender({ env = process.env, post = axios.post } = {}) {
    return async (to, subject, text, html) => {
        const provider = (env.EMAIL_PROVIDER || 'promail').trim().toLowerCase();
        let url, body, headers;
        if (provider === 'brevo') {
            const sender = (env.EMAIL_FROM || '').trim();
            if (!env.BREVO_API_KEY?.trim() || !validator.isEmail(sender)) {
                const error = new Error('Email provider is not configured.'); error.code = 'EMAIL_CONFIGURATION'; throw error;
            }
            url = 'https://api.brevo.com/v3/smtp/email';
            body = { sender: { name: 'DevTinder', email: sender }, to: [{ email: to }], subject,
                htmlContent: html, ...(text ? { textContent: text } : {}) };
            headers = { 'api-key': env.BREVO_API_KEY.trim(), 'Content-Type': 'application/json' };
        } else if (provider === 'promail' && env.PROMAIL_API_KEY?.trim()) {
            url = 'https://mailserver.automationlounge.com/api/v1/messages/send';
            body = { to, subject, html };
            headers = { Authorization: 'Bearer ' + env.PROMAIL_API_KEY.trim(), 'Content-Type': 'application/json' };
        } else {
            const error = new Error('Email provider is not configured.'); error.code = 'EMAIL_CONFIGURATION'; throw error;
        }
        try {
            const response = await post(url, body, { headers, timeout: 20000 });
            // Brevo documents messageId on successful acceptance. Do not mistake
            // a malformed success response for confirmation that the code was sent.
            if (provider === 'brevo' && !response.data?.messageId) throw Object.assign(new Error('Invalid email acceptance response'), { code: 'EMAIL_RESPONSE' });
            return response.data;
        } catch (cause) {
            // Never log axios config/headers, email bodies, OTPs or provider responses.
            const status = Number(cause.response?.status) || 0;
            const safeCode = /^[A-Z_0-9]+$/.test(cause.code || '') ? cause.code : 'EMAIL_PROVIDER_ERROR';
            console.warn(`Email delivery unavailable: provider=${provider}, status=${status}, code=${safeCode}`);
            const error = new Error('Verification email could not be sent. Please try again later.');
            error.code = 'EMAIL_UNAVAILABLE'; throw error;
        }
    };
}
module.exports = { sendEmail: createEmailSender(), createEmailSender };
