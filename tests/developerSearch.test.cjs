const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user');
const userRouter = require('../src/routes/user');
const { createDeveloperSearchHandler } = require('../src/utils/developerSearch');

function database(rows = []) {
    const calls = {};
    const model = { find(filter) {
        calls.filter = filter;
        return {
            select(value) { calls.selection = value; return this; },
            sort(value) { calls.sort = value; return this; },
            skip(value) { calls.skip = value; return this; },
            limit(value) { calls.limit = value; return this; },
            async lean() {
                return rows.filter(row => row._id !== filter._id.$ne && filter.$or.some(part =>
                    Object.entries(part).some(([field, regex]) => regex.test(row[field] || ''))
                )).slice(calls.skip, calls.skip + calls.limit);
            },
        };
    } };
    return { model, calls };
}

async function search(model, query) {
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await createDeveloperSearchHandler(model)({ query, user: { _id: 'self' } }, response);
    return response;
}

test('am finds Aman, Amanda and Amit by case-insensitive prefix without exposing private data', async () => {
    const rows = ['Aman', 'Amanda', 'Amit', 'Sam'].map((firstName, index) => ({ _id: String(index), firstName, lastName: 'Dev', password: 'secret', emailId: 'private@example.test', resumeUrl: 'private.pdf' }));
    rows.push({ _id: 'self', firstName: 'Aman' });
    const { model, calls } = database(rows);
    const response = await search(model, { q: ' AM ' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.users.map(user => user.firstName), ['Aman', 'Amanda', 'Amit']);
    assert.ok(response.body.users.every(user => !('password' in user) && !('emailId' in user) && !('resumeUrl' in user)));
    assert.equal(calls.filter._id.$ne, 'self');
    assert.equal(calls.selection.includes('password'), false);
    assert.equal(calls.selection.includes('emailId'), false);
});

test('last names are searchable and regex punctuation is treated literally', async () => {
    const { model } = database([{ _id: '1', firstName: 'Jo', lastName: 'Amir' }, { _id: '2', firstName: 'A.man' }, { _id: '3', firstName: 'Aman' }]);
    assert.deepEqual((await search(model, { q: 'am' })).body.users.map(row => row._id), ['1', '3']);
    assert.deepEqual((await search(model, { q: 'a.' })).body.users.map(row => row._id), ['2']);
    assert.deepEqual((await search(model, { q: '.*' })).body.users, []);
});

test('search is paginated and reports whether another page exists', async () => {
    const { model, calls } = database(Array.from({ length: 25 }, (_, index) => ({ _id: String(index), firstName: 'Aman' })));
    const first = await search(model, { q: 'am' });
    assert.equal(first.body.users.length, 20);
    assert.equal(first.body.hasMore, true);
    const second = await search(model, { q: 'am', page: '2' });
    assert.equal(second.body.users.length, 5);
    assert.equal(second.body.hasMore, false);
    assert.equal(calls.skip, 20);
    assert.equal(calls.limit, 21);
    assert.deepEqual(calls.sort, { firstName: 1, lastName: 1, _id: 1 });
});

test('invalid input is rejected before any database search', async () => {
    const model = { find() { throw new Error('Must not query invalid input'); } };
    for (const query of [{ q: 'a' }, { q: 'a'.repeat(81) }, { q: { $ne: '' } }, { q: 'am', page: '-1' }, { q: 'am', page: '1001' }, { q: 'am', page: ['1'] }]) {
        assert.equal((await search(model, query)).statusCode, 400);
    }
});

test('database errors return a useful response without leaking internal details', async () => {
    const { model } = database();
    model.find = () => { throw new Error('Private connection details'); };
    const response = await search(model, { q: 'am' });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: 'Could not search developers. Please try again.' });
});

test('the real search route requires a valid existing JWT cookie', async t => {
    const previousKey = process.env.JWT_KEY;
    const previousFind = User.find;
    const previousFindById = User.findById;
    process.env.JWT_KEY = 'local-search-test-key';
    const { model } = database([{ _id: 'other', firstName: 'Amanda' }]);
    User.find = model.find;
    User.findById = async () => ({ _id: 'self' });
    const app = express();
    app.use(cookieParser());
    app.use(userRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        User.find = previousFind;
        User.findById = previousFindById;
        if (previousKey === undefined) delete process.env.JWT_KEY; else process.env.JWT_KEY = previousKey;
    });
    const url = `http://127.0.0.1:${server.address().port}/user/search?q=am`;
    const anonymous = await fetch(url, { signal: AbortSignal.timeout(5000) });
    assert.equal(anonymous.status, 400);
    assert.match(await anonymous.text(), /Invalid Token/);
    const token = jwt.sign({ _id: 'self' }, process.env.JWT_KEY, { expiresIn: '1d' });
    const authenticated = await fetch(url, { headers: { Cookie: 'token=' + token }, signal: AbortSignal.timeout(5000) });
    assert.equal(authenticated.status, 200);
    assert.equal((await authenticated.json()).users[0].firstName, 'Amanda');
});
