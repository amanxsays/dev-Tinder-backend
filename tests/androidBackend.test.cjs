const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createHash, createHmac } = require('node:crypto');
const { issueMobileToken, verifySession, requestSession, socketSession } = require('../src/utils/authSession');
const { userDto } = require('../src/utils/userDto');
const { createMobileAuthRouter } = require('../src/routes/mobileAuth');
const { createPushRouter, hash } = require('../src/routes/push');
const { notificationEvent, persistWithNotification } = require('../src/services/notificationService');
const { pushData, deliverEvent, startNotificationDispatcher } = require('../src/services/notificationDispatcher');
const { requireConnection, saveMessage } = require('../src/services/chatService');
const initializeSocket = require('../src/utils/socket');
const { serviceAssertion } = require('../src/utils/serviceAssertion');
const { createAiRouter } = require('../src/routes/ai');
const http = require('node:http');
const USER = '507f1f77bcf86cd799439011';
const TARGET = '507f1f77bcf86cd799439012';
const SECRET = 'local-fixture-key-never-used-in-production';

function key(t) {
    const previous = process.env.JWT_KEY;
    process.env.JWT_KEY = SECRET;
    t.after(() => { if (previous === undefined) delete process.env.JWT_KEY; else process.env.JWT_KEY = previous; });
}
async function listen(t, app) {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}`;
}

test('native session has exact ten-day expiry and strict audience/issuer', t => {
    key(t);
    const token = issueMobileToken({ _id: USER });
    const claims = verifySession(token, true);
    assert.equal(claims.exp - claims.iat, 864000);
    assert.equal(claims.aud, 'devtinder-android');
    assert.equal(claims.iss, 'devtinder-api');
    assert.throws(() => verifySession(jwt.sign({ _id: USER }, SECRET, { expiresIn: '1d' }), true));
    assert.throws(() => verifySession(token, false));
    assert.equal(socketSession({ auth: { token }, headers: {} })._id, USER);
});

test('invalid bearer never falls back to a valid browser cookie', t => {
    key(t);
    const cookie = jwt.sign({ _id: USER }, SECRET, { expiresIn: '1d' });
    assert.equal(requestSession({ cookies: { token: cookie } })._id, USER);
    assert.throws(() => requestSession({ headers: { authorization: 'Bearer broken' }, cookies: { token: cookie } }));
    assert.throws(() => socketSession({ auth: { token: 'broken' }, headers: { cookie: 'token=' + cookie } }));
    const expired = jwt.sign({ _id: USER, iat: Math.floor(Date.now() / 1000) - 86401 }, SECRET,
        { expiresIn: '1d', audience: 'devtinder-android', issuer: 'devtinder-api' });
    assert.throws(() => verifySession(expired, true));
});

test('mobile login and signup share services but never expose password hashes or cookies', async t => {
    key(t);
    const calls = [];
    const app = express(); app.use(express.json());
    app.use(createMobileAuthRouter(Object.fromEntries(['login', 'signup'].map(action => [action, async body => {
        calls.push([action, body]); return { _id: USER, firstName: 'Aman', password: 'private-hash', otp: 'secret', __v: 1 };
    }]))));
    const base = await listen(t, app);
    for (const action of ['login', 'signup']) {
        const response = await fetch(base + '/mobile/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const body = await response.json();
        assert.deepEqual(body.data, { _id: USER, firstName: 'Aman' });
        assert.equal(verifySession(body.token, true)._id, USER);
        const claims = verifySession(body.token, true);
        assert.equal(claims.exp - claims.iat, 864000);
        assert.equal(Date.parse(body.expiresAt), claims.exp * 1000);
    }
    assert.deepEqual(calls.map(([action]) => action), ['login', 'signup']);
    assert.equal(userDto({ toObject: () => ({ password: 'private', _id: USER }) }).password, undefined);
});

test('HTTP and socket native sessions work after day one and reject tokens older than ten days', t => {
    key(t);
    const now = Math.floor(Date.now() / 1000);
    const tokenAtAge = seconds => jwt.sign({ _id: USER, iat: now - seconds }, SECRET,
        { expiresIn: '20d', audience: 'devtinder-android', issuer: 'devtinder-api' });
    for (const age of [2 * 86400, 10 * 86400 - 10]) {
        const token = tokenAtAge(age);
        assert.equal(requestSession({ headers: { authorization: 'Bearer ' + token } })._id, USER);
        assert.equal(socketSession({ auth: { token } })._id, USER);
        assert.throws(() => verifySession(token, false));
    }
    const tooOld = tokenAtAge(10 * 86400 + 10);
    assert.throws(() => requestSession({ headers: { authorization: 'Bearer ' + tooOld } }));
    assert.throws(() => socketSession({ auth: { token: tooOld } }));
    const oldShortToken = jwt.sign({ _id: USER, iat: now - 86410 }, SECRET,
        { expiresIn: '1d', audience: 'devtinder-android', issuer: 'devtinder-api' });
    assert.throws(() => verifySession(oldShortToken, true));
});

test('connection authorization rejects strangers and malformed targets before database access', async () => {
    let calls = 0;
    const Connections = { findOne: async query => { calls++; assert.equal(query.status, 'accepted'); return null; } };
    await assert.rejects(() => requireConnection(USER, 'invalid', Connections), /Invalid/);
    await assert.rejects(() => requireConnection(USER, USER, Connections), /Invalid/);
    assert.equal(calls, 0);
    await assert.rejects(() => requireConnection(USER, TARGET, Connections), /accepted/);
    assert.equal(calls, 1);
});

test('chat save failures reject before returning canonical messages', async () => {
    let persisted = false;
    const chat = { messages: [], save: async () => { throw new Error('database fixture failure'); } };
    await assert.rejects(() => saveMessage({ _id: USER, firstName: 'Real sender' }, TARGET, 'hello', {
        Connections: { findOne: async () => ({ status: 'accepted' }) }, Chats: { findOne: async () => chat },
        persist: async save => { await save(null); persisted = true; },
    }), /database fixture failure/);
    assert.equal(persisted, false);
    assert.equal(String(chat.messages[0].senderId), USER);
});

test('socket uses authenticated identity and broadcasts only after successful persistence', async t => {
    key(t);
    const handlers = {}, broadcasts = [], acknowledgements = [];
    let middleware, connect, fail = false;
    const io = { use(fn) { middleware = fn; }, on(name, fn) { if (name === 'connection') connect = fn; },
        to(room) { return { emit(name, payload) { broadcasts.push({ room, name, payload }); } }; } };
    const service = { requireConnection: async (user, target) => { assert.equal(user, USER); assert.equal(target, TARGET); },
        roomId: (a, b) => [a, b].sort().join('_'), saveMessage: async (user, target, text) => {
            assert.equal(user._id, USER); if (fail) throw new Error('database unavailable');
            return { _id: 'canonical-message', senderId: USER, targetUserId: target, text, firstName: user.firstName };
        } };
    initializeSocket(null, { io, Users: { findById: async () => ({ _id: USER, firstName: 'Real sender' }) }, chatService: service });
    const socket = { handshake: { auth: { token: issueMobileToken({ _id: USER }) } }, data: {},
        on(name, fn) { handlers[name] = fn; }, join: async () => {}, disconnect() {} };
    let error;
    await middleware(socket, value => { error = value; }); assert.equal(error, undefined);
    connect(socket); t.after(() => handlers.disconnect());
    await handlers.joinChat({ userId: 'spoofed', targetUserId: TARGET }, value => acknowledgements.push(value));
    await handlers.sendMessage({ userId: 'spoofed', firstName: 'Impersonator', targetUserId: TARGET, text: 'hello' }, value => acknowledgements.push(value));
    assert.equal(broadcasts.length, 1); assert.equal(broadcasts[0].payload.firstName, 'Real sender');
    assert.equal(acknowledgements[1].ok, true);
    fail = true;
    await handlers.sendMessage({ targetUserId: TARGET, text: 'unsaved' }, value => acknowledgements.push(value));
    assert.equal(broadcasts.length, 1); assert.equal(acknowledgements.at(-1).ok, false);
    await middleware({ handshake: { auth: { token: 'bad' } }, data: {} }, value => { error = value; });
    assert.match(error.message, /Authentication/);
});

test('business save and notification event share a transaction; a failed save creates no event', async () => {
    const calls = [];
    const session = { async withTransaction(fn) { calls.push('begin'); await fn(); calls.push('commit'); }, async endSession() { calls.push('end'); } };
    const options = { enabled: true, database: { startSession: async () => session }, Events: { create: async (_events, opts) => {
        assert.equal(opts.session, session); calls.push('event');
    } } };
    await persistWithNotification(async received => { assert.equal(received, session); calls.push('save'); }, { eventId: 'fixture' }, options);
    assert.deepEqual(calls, ['begin', 'save', 'event', 'commit', 'end']);
    calls.length = 0;
    await assert.rejects(() => persistWithNotification(async () => { calls.push('save'); throw new Error('failed'); }, {}, options));
    assert.deepEqual(calls, ['begin', 'save', 'end']);
    calls.length = 0;
    await persistWithNotification(async received => { assert.equal(received, null); calls.push('save'); }, {}, { enabled: false });
    assert.deepEqual(calls, ['save']);
});

test('device proof guards rebind, rotation, expiry and offline-capable revocation', async t => {
    let record = null;
    let currentTime = new Date('2026-01-01T00:00:00Z');
    const Installations = {
        findOne: () => ({ select: async () => record }),
        create: async values => { record = { _id: 'device-db-id', ...values }; return record; },
        findOneAndUpdate: async (_filter, update) => { record = { _id: 'device-db-id', ...record, ...update.$set }; return record; },
        updateOne: async (_filter, update) => { Object.assign(record, update.$set); },
    };
    const app = express(); app.use(express.json());
    app.use(createPushRouter({ Installations, now: () => currentTime, authenticate(req, _res, next) { req.user = { _id: req.headers['x-fixture-user'] || USER }; next(); } }));
    const base = await listen(t, app);
    const installationId = 'installation-fixture-1234';
    const installationSecret = 'a'.repeat(48);
    const token = 'fixture-fcm-token-' + 'x'.repeat(30);
    const send = (suffix = '', body = {}, headers = {}, method = 'PUT') => fetch(base + '/push/installations/' + installationId + suffix,
        { method, headers: { 'Content-Type': 'application/json', ...headers }, body: method === 'DELETE' ? undefined : JSON.stringify(body) });
    let response = await send('', { token, installationSecret, platform: 'android', environment: 'development' });
    assert.equal(response.status, 200);
    const first = await response.json(); assert.equal(record.secretHash, hash(installationSecret));
    assert.equal(record.userId, USER); assert.equal(new Date(first.expiresAt) - currentTime, 30 * 86400000);
    response = await send('', { token, installationSecret: 'b'.repeat(48), platform: 'android', environment: 'development' }, { 'X-Fixture-User': TARGET });
    assert.equal(response.status, 403); assert.equal(record.userId, USER);
    response = await send('/token', { token: token + 'new', userId: TARGET }, { 'X-Installation-Secret': installationSecret });
    assert.equal(response.status, 200); assert.equal(record.userId, USER); assert.equal(record.bindingId, first.bindingId);
    response = await send('', { token, installationSecret, platform: 'android', environment: 'development' }, { 'X-Fixture-User': TARGET });
    assert.equal(response.status, 200); assert.equal(record.userId, TARGET); assert.notEqual(record.bindingId, first.bindingId);
    currentTime = new Date('2026-03-01T00:00:00Z');
    assert.equal((await send('/token', { token }, { 'X-Installation-Secret': installationSecret })).status, 410);
    assert.equal((await send('', null, { 'X-Installation-Secret': installationSecret }, 'DELETE')).status, 204);
    assert.equal(record.enabled, false);
});

test('dispatcher has private, bounded payloads and cleans invalid tokens without deleting refreshed registrations', async () => {
    const event = { _id: 'event-db', leaseOwner: 'lease', ...notificationEvent('message', 'msg-id', TARGET, USER), deliveredBindings: [] };
    const installation = { _id: 'installation-db', installationId: 'installation', token: 'token', bindingId: 'binding' };
    assert.deepEqual(Object.keys(pushData(event, installation)).sort(), ['bindingId', 'createdAt', 'eventId', 'expiresAt', 'messagePreview', 'senderName', 'targetUserId', 'type']);
    const removed = [], saved = [], sent = [];
    const Installations = { find: () => ({ select: async () => [installation] }), findOne: async () => installation,
        deleteOne: async query => removed.push(query) };
    const Events = { updateOne: async (_filter, update) => saved.push(update) };
    assert.equal(await deliverEvent(event, { Installations, Events, send: async message => sent.push(message) }), true);
    assert.equal(sent[0].notification, undefined); assert.equal(sent[0].android.priority, 'high');
    assert.ok(sent[0].android.ttl <= 86400000); assert.ok(saved.some(update => update.$addToSet));
    assert.equal(await deliverEvent(event, { Installations, Events, send: async () => { throw Object.assign(new Error(), { code: 'messaging/registration-token-not-registered' }); } }), true);
    assert.deepEqual(removed[0], { _id: 'installation-db', bindingId: 'binding', token: 'token' });
    assert.equal(await deliverEvent(event, { Installations, Events, send: async () => { throw new Error('temporary'); } }), false);
    sent.length = 0;
    await deliverEvent({ ...event, deliveredBindings: ['installation:binding'] }, { Installations, Events, send: async message => sent.push(message) });
    assert.equal(sent.length, 0);
    Installations.findOne = async () => null;
    await deliverEvent(event, { Installations, Events, send: async message => sent.push(message) });
    assert.equal(sent.length, 0);
    assert.equal(typeof startNotificationDispatcher({ enabled: false }), 'function');
});

test('service assertion binds UTF8 query and authenticated ID to the exact Spring protocol', () => {
    const query = 'Summarise Aman’s résumé';
    const headers = serviceAssertion(USER, query, { secret: SECRET, now: () => 1700000000000 });
    const digest = createHash('sha256').update(query, 'utf8').digest('hex');
    const signature = createHmac('sha256', SECRET).update(`POST\n/api/chat/stream\n${USER}\n1700000000\n${digest}`).digest('hex');
    assert.equal(headers['X-DevTinder-Signature'], signature);
    assert.notEqual(serviceAssertion(TARGET, query, { secret: SECRET, now: () => 1700000000000 })['X-DevTinder-Signature'], signature);
    assert.throws(() => serviceAssertion(USER, query, { secret: 'short' }));
});

test('AI gateway replaces forged identity and streams before the upstream completes', async t => {
    let upstreamBody;
    let finish;
    const upstream = http.createServer(async (req, res) => {
        let text = ''; for await (const chunk of req) text += chunk;
        upstreamBody = JSON.parse(text);
        assert.equal(req.headers['x-devtinder-user'], USER);
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.write('event:status\ndata:Thinking\n\n');
        finish = () => res.end('event:message\ndata:Done\n\n');
    });
    upstream.listen(0, '127.0.0.1'); await new Promise(resolve => upstream.once('listening', resolve));
    t.after(() => new Promise(resolve => upstream.close(resolve)));
    const app = express(); app.use(express.json());
    app.use(createAiRouter({ authenticate(req, _res, next) { req.user = { _id: USER }; next(); },
        getBaseUrl: () => `http://127.0.0.1:${upstream.address().port}`,
        assertion: (user, query) => serviceAssertion(user, query, { secret: SECRET }) }));
    const base = await listen(t, app);
    const response = await fetch(base + '/ai/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'hello', userId: TARGET }), signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /Thinking/);
    assert.equal(upstreamBody.userId, USER);
    finish();
    let result = ''; for (;;) { const chunk = await reader.read(); if (chunk.done) break; result += new TextDecoder().decode(chunk.value); }
    assert.match(result, /Done/);
});

test('a concurrent first registration cannot overwrite the installation winner or secret', async t => {
    let record;
    let reads = 0;
    let releaseReads;
    const bothRead = new Promise(resolve => { releaseReads = resolve; });
    const Installations = {
        findOne: () => ({ select: async () => { if (++reads === 2) releaseReads(); await bothRead; return null; } }),
        create: async values => {
            if (record) throw Object.assign(new Error('duplicate fixture'), { code: 11000 });
            record = { ...values, _id: 'winner' }; return record;
        },
        findOneAndUpdate() { throw new Error('First registration must never use an overwrite upsert'); },
    };
    const app = express(); app.use(express.json());
    app.use(createPushRouter({ Installations, authenticate(req, _res, next) { req.user = { _id: req.headers['x-user'] }; next(); } }));
    const base = await listen(t, app);
    const attempt = (user, secret) => fetch(base + '/push/installations/concurrent-installation-id', { method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User': user },
        body: JSON.stringify({ token: 'fixture-token-long-enough-' + user, platform: 'android', environment: 'development', installationSecret: secret }) });
    const responses = await Promise.all([attempt(USER, 'a'.repeat(48)), attempt(TARGET, 'b'.repeat(48))]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
    const winner = responses[0].status === 200 ? USER : TARGET;
    assert.equal(record.userId, winner);
    assert.equal(record.secretHash, hash((winner === USER ? 'a' : 'b').repeat(48)));
});

test('a stale binding capability cannot revoke or rotate the newly signed-in account', async t => {
    const record = { _id: 'db', secretHash: hash('a'.repeat(48)), bindingId: 'new-account-binding', enabled: true,
        expiresAt: new Date(Date.now() + 86400000) };
    let writes = 0;
    const app = express(); app.use(express.json());
    app.use(createPushRouter({ Installations: { findOne: () => ({ select: async () => record }), updateOne: async () => { writes++; } } }));
    const base = await listen(t, app);
    for (const [method, suffix] of [['DELETE', ''], ['PUT', '/token']]) {
        const response = await fetch(base + '/push/installations/stale-installation-id' + suffix, { method,
            headers: { 'Content-Type': 'application/json', 'X-Installation-Secret': 'a'.repeat(48), 'X-Installation-Binding': 'old-account-binding' },
            body: method === 'PUT' ? JSON.stringify({ token: 'fixture-token-long-enough-for-test' }) : undefined });
        assert.equal(response.status, 409);
    }
    assert.equal(writes, 0);
});

test('upstream assertion failures do not invalidate a valid user session', async t => {
    const upstream = http.createServer((_req, res) => res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"private":"service configuration"}'));
    upstream.listen(0, '127.0.0.1'); await new Promise(resolve => upstream.once('listening', resolve));
    t.after(() => new Promise(resolve => upstream.close(resolve)));
    const app = express(); app.use(express.json());
    app.use(createAiRouter({ authenticate(req, _res, next) { req.user = { _id: USER }; next(); },
        getBaseUrl: () => `http://127.0.0.1:${upstream.address().port}`, assertion: () => ({}) }));
    const base = await listen(t, app);
    const response = await fetch(base + '/ai/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"query":"hello"}' });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private|configuration/);
});

test('weak password validation never echoes the attempted password', async () => {
    const { validateSignupData } = require('../src/utils/validation');
    const password = 'private-short-password';
    assert.throws(() => validateSignupData({ body: { firstName: 'Aman', lastName: 'Jha', emailId: 'fixture@example.test', password } }),
        error => error.message === 'Password is too weak' && !error.message.includes(password));
});

test('dispatcher resumes an expired lease and records transient failure for a bounded retry', async () => {
    const event = { _id: 'event-recovery', attempts: 2, leaseOwner: '', ...notificationEvent('message', 'recovery', TARGET, USER) };
    const updates = [];
    let acquired = false;
    const Events = {
        updateMany: async () => {},
        async findOneAndUpdate(query, update) {
            assert.ok(query.$or.some(condition => condition.state === 'processing'));
            assert.equal(query.attempts.$lt, 6);
            if (acquired) return null;
            acquired = true; event.leaseOwner = update.$set.leaseOwner; return event;
        },
        updateOne: async (_filter, update) => { updates.push(update); },
    };
    const Installations = { find: () => ({ select: async () => [{ _id: 'device', installationId: 'installation', bindingId: 'binding', token: 'token' }] }),
        findOne: async () => ({ _id: 'device' }) };
    const stop = startNotificationDispatcher({ enabled: true, Events, Installations, intervalMs: 100000,
        send: async () => { throw new Error('FCM fixture outage'); } });
    try {
        await new Promise(resolve => setTimeout(resolve, 30));
        const final = updates.find(update => update.$set?.state);
        assert.equal(final.$set.state, 'pending');
        assert.equal(final.$set.failureCode, 'dispatch_unavailable');
        assert.ok(final.$set.nextAttemptAt > new Date());
    } finally { stop(); }
});

test('message previews use the authenticated sender and are queued with successful persistence', async () => {
    let outbox;
    const message = await saveMessage({ _id: USER, firstName: 'Riya', lastName: 'Dev' }, TARGET, 'Hello Aman', {
        Connections: { findOne: async () => ({ status: 'accepted' }) },
        Chats: { findOne: async () => ({ messages: [], save: async () => {} }) },
        persist: async (save, event) => { await save(null); outbox = event; },
    });
    assert.equal(message.text, 'Hello Aman');
    assert.equal(outbox.senderName, 'Riya Dev');
    assert.equal(outbox.messagePreview, 'Hello Aman');
    const data = pushData({ ...outbox, senderName: 'R'.repeat(200), messagePreview: 'x'.repeat(16000) }, { bindingId: 'binding' });
    assert.equal(data.senderName.length, 80);
    assert.equal(data.messagePreview.length, 240);
    assert.equal(data.targetUserId, USER);
    const request = pushData(notificationEvent('connection_request', 'request', TARGET), { bindingId: 'binding' });
    assert.equal(request.messagePreview, undefined);
});
