const express = require('express');
const jwt = require('jsonwebtoken');
const { issueMobileToken } = require('../utils/authSession');
const { userDto } = require('../utils/userDto');
const authService = require('../services/authService');

function createMobileAuthRouter(service = authService) {
    const router = express.Router();
    for (const action of ['login', 'signup']) {
        router.post('/mobile/' + action, async (req, res) => {
            res.set('Cache-Control', 'no-store');
            try {
                const user = await service[action](req.body || {});
                const token = issueMobileToken(user);
                res.json({ message: action === 'login' ? 'Signed in successfully.' : 'User Added Successfully',
                    data: userDto(user), token,
                    expiresAt: new Date(jwt.decode(token).exp * 1000).toISOString() });
            } catch {
                res.status(400).json({ message: action === 'login' ? 'Invalid credentials' : 'Could not create account. Check your details and OTP.' });
            }
        });
    }
    return router;
}
module.exports = createMobileAuthRouter();
module.exports.createMobileAuthRouter = createMobileAuthRouter;
