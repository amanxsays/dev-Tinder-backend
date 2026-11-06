const bcrypt = require('bcrypt');
const User = require('../models/user');
const Otp = require('../models/otp');
const { validateSignupData } = require('../utils/validation');
const { sendEmail } = require('../utils/send-email');
const { validOtp } = require('./otpService');
const registrationTemplate = require('../utils/templates/registerationTemplate');

async function login(body) {
    if (typeof body.emailId !== 'string' || typeof body.password !== 'string') throw new Error('Invalid credentials');
    const user = await User.findOne({ emailId: body.emailId.trim().toLowerCase() });
    if (!user || !await user.validatePass(body.password)) throw new Error('Invalid credentials');
    return user;
}

async function signup(body) {
    validateSignupData({ body });
    const { firstName, lastName, password, otp } = body;
    const emailId = body.emailId.trim().toLowerCase();
    const verification = await Otp.findOne({ emailId });
    if (!validOtp(verification, otp)) throw new Error('Invalid Otp');
    // Do not consume a valid code until the user has actually been saved.
    const user = new User({ firstName, lastName, emailId,
        password: await bcrypt.hash(password, 10),
        photoUrl: 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=' + encodeURIComponent(firstName + lastName) });
    await user.save();
    await Otp.deleteOne({ _id: verification._id });
    void Promise.resolve(sendEmail(emailId, `Welcome ${firstName} !`, '', registrationTemplate(firstName, lastName)))
        .catch(() => console.warn('Registration email could not be sent.'));
    return user;
}

module.exports = { login, signup };
