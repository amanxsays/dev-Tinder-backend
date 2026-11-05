const jwt = require('jsonwebtoken');
const { SESSION_TTL_SECONDS, MOBILE_SESSION_TTL_SECONDS } = require('./sessionPolicy');

const MOBILE_AUDIENCE = 'devtinder-android';
const MOBILE_ISSUER = 'devtinder-api';

function issueMobileToken(user) {
    return jwt.sign({ _id: String(user._id) }, process.env.JWT_KEY, {
        algorithm: 'HS256', expiresIn: MOBILE_SESSION_TTL_SECONDS,
        audience: MOBILE_AUDIENCE, issuer: MOBILE_ISSUER,
    });
}

function verifySession(token, mobile = false) {
    if (typeof token !== 'string' || !token || token.length > 8192) throw new Error('Invalid Token');
    const claims = jwt.verify(token, process.env.JWT_KEY, {
        algorithms: ['HS256'], maxAge: mobile ? MOBILE_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS,
        ...(mobile ? { audience: MOBILE_AUDIENCE, issuer: MOBILE_ISSUER } : {}),
    });
    if (!claims || !/^[a-f\d]{24}$/i.test(claims._id || '') || !Number.isFinite(claims.exp)) {
        throw new Error('Invalid Token');
    }
    // A native token must never be accepted as a browser cookie with relaxed claims.
    if (!mobile && (claims.aud || claims.iss)) throw new Error('Invalid Token');
    return claims;
}

function requestSession(req) {
    const authorization = req.headers?.authorization;
    if (authorization !== undefined) {
        const match = /^Bearer ([^\s]+)$/i.exec(authorization);
        if (!match) throw new Error('Invalid Token');
        return verifySession(match[1], true);
    }
    return verifySession(req.cookies?.token, false);
}

function socketSession(handshake) {
    if (handshake.auth?.token !== undefined) return verifySession(handshake.auth.token, true);
    const cookie = String(handshake.headers?.cookie || '').split(';').map(item => item.trim())
        .find(item => item.startsWith('token='));
    let token;
    try { token = cookie ? decodeURIComponent(cookie.slice(6)) : ''; }
    catch { throw new Error('Invalid Token'); }
    return verifySession(token, false);
}

module.exports = { issueMobileToken, verifySession, requestSession, socketSession };
