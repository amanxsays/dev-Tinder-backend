const express = require('express');
const { issueMobileToken } = require('../utils/authSession');
const { userDto } = require('../utils/userDto');
const { SESSION_TTL_SECONDS } = require('../utils/sessionPolicy');
const authService = require('../services/authService');

function createMobileAuthRouter(service = authService) {
    const router = express.Router();
    for (const action of ['login', 'signup']) {
        router.post('/mobile/' + action, async (req, res) => {
            res.set('Cache-Control', 'no-store');
            try {
                const user = await service[action](req.body || {});
                res.json({ message: action === 'login' ? 'Signed in successfully.' : 'User Added Successfully',
                    data: userDto(user), token: issueMobileToken(user),
                    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString() });
            } catch {
                res.status(400).json({ message: action === 'login' ? 'Invalid credentials' : 'Could not create account. Check your details and OTP.' });
            }
        });
    }
    return router;
}
module.exports = createMobileAuthRouter();
module.exports.createMobileAuthRouter = createMobileAuthRouter;
