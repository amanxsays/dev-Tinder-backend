const User= require('../models/user');
const { requestSession } = require('../utils/authSession');

const userAuth= async (req,res,next)=>{
    try {
        const decodeToken = requestSession(req);
        const { _id }=decodeToken;

        const user= await User.findById(_id);
        if(!user) throw new Error("User Does Not Exist !!!!");

        req.user=user;
        req.sessionClaims=decodeToken;
        next();

    } catch (error) {
        const expected = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)
            || ['Invalid Token', 'User Does Not Exist !!!!'].includes(error.message);
        if (expected) res.status(400).send('Error: ' + error.message);
        else res.status(503).send('Session verification is temporarily unavailable.');
    }
}

module.exports = {userAuth};
