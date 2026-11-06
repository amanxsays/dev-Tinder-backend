const express= require('express');
const { sessionCookieOptions } = require('../utils/sessionPolicy');
const authService = require('../services/authService');
const { requestOtp } = require('../services/otpService');
const { userDto } = require('../utils/userDto');

const authRouter=express.Router();

authRouter.post('/signup', async (req, res) => {
    try {
        const user = await authService.signup(req.body || {});
        res.cookie('token', await user.getJWT(), sessionCookieOptions());
        res.json({ message: 'User Added Successfully', data: userDto(user) });
    } catch { res.status(400).send('Error: Could not create account. Check your details and OTP.'); }
});

authRouter.post('/otp', async (req, res) => {
    try { res.json(await requestOtp(req.body || {})); }
    catch (error) {
        if (error.details?.retryAfterSeconds) res.set('Retry-After', String(error.details.retryAfterSeconds));
        res.status(error.status || 503).json({ code: error.code || 'OTP_UNAVAILABLE',
            message: error.status ? error.message : 'Verification is temporarily unavailable. Please try again later.', ...error.details });
    }
});

authRouter.post('/login', async (req, res) => {
    try {
        const user = await authService.login(req.body || {});
        res.cookie('token', await user.getJWT(), sessionCookieOptions());
        res.json({ message: user.firstName + ' logged in successfully.', data: userDto(user) });
    } catch { res.status(400).send('Error: Invalid credentials'); }
});

authRouter.post("/logout", async (req,res)=>{
    res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.send("Logout Successfully");
})


module.exports = authRouter;
