const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user');
const { userAuth } = require('../src/middleware/auth');
const { SESSION_TTL_SECONDS, sessionCookieOptions } = require('../src/utils/sessionPolicy');

const KEY = 'local-session-policy-test-key';
const USER_ID = '507f1f77bcf86cd799439011';
function fixtureKey(t) {
    const previous = process.env.JWT_KEY;
    process.env.JWT_KEY = KEY;
    t.after(() => { if (previous === undefined) delete process.env.JWT_KEY; else process.env.JWT_KEY = previous; });
}

test('new user JWTs expire exactly 24 hours after issue', async t => {
    fixtureKey(t);
    const token = await new User({ _id: USER_ID }).getJWT();
    const claims = jwt.verify(token, KEY);
    assert.equal(claims.exp - claims.iat, 86400);
    assert.equal(SESSION_TTL_SECONDS, 86400);
});

test('HTTP authentication rejects old seven-day tokens once they are over one day old', async t => {
    fixtureKey(t);
    const previous = User.findById;
    let queried = false;
    User.findById = async () => { queried = true; return { _id: USER_ID }; };
    t.after(() => { User.findById = previous; });
    const token = jwt.sign({ _id: USER_ID, iat: Math.floor(Date.now() / 1000) - 86401 }, KEY, { expiresIn: '7d' });
    let status, message, allowed = false;
    await userAuth({ cookies: { token } }, {
        status(value) { status = value; return this; }, send(value) { message = value; },
    }, () => { allowed = true; });
    assert.equal(status, 400);
    assert.match(message, /maxAge exceeded/);
    assert.equal(allowed, false);
    assert.equal(queried, false);
});

test('a valid recent session still authenticates through the existing middleware', async t => {
    fixtureKey(t);
    const previous = User.findById;
    User.findById = async id => { assert.equal(id, USER_ID); return { _id: USER_ID }; };
    t.after(() => { User.findById = previous; });
    const token = jwt.sign({ _id: USER_ID }, KEY, { expiresIn: '1d' });
    const request = { cookies: { token } };
    let allowed = false;
    await userAuth(request, { status() { throw new Error('Valid session rejected'); } }, () => { allowed = true; });
    assert.equal(allowed, true);
    assert.equal(request.user._id, USER_ID);
});

test('the shared login/signup cookie lasts one day and retains its security flags', async t => {
    const app = express();
    app.get('/', (_req, res) => res.cookie('token', 'fixture', sessionCookieOptions()).end());
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, { signal: AbortSignal.timeout(5000) });
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /Max-Age=86400/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=None/);
});
