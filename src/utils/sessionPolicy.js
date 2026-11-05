const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MOBILE_SESSION_TTL_SECONDS = 10 * 24 * 60 * 60;

function sessionCookieOptions() {
    return { httpOnly: true, secure: true, sameSite: 'none', maxAge: SESSION_TTL_SECONDS * 1000 };
}

module.exports = { SESSION_TTL_SECONDS, MOBILE_SESSION_TTL_SECONDS, sessionCookieOptions };
