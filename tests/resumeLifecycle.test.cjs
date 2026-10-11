const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../src/models/user');
const { createResumeUpdate, sourceMatchesCurrentResume, notifyResumeService } = require('../src/utils/resumeLifecycle');

const candidateId = '507f1f77bcf86cd799439011';
let user;
let calls;
const authPath = require.resolve('../src/middleware/auth');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true,
    exports: { userAuth: (req, res, next) => { req.user = user; next(); } } };
const cloudPath = require.resolve('../src/utils/resumeUpload');
require.cache[cloudPath] = { id: cloudPath, filename: cloudPath, loaded: true, exports: { cloudinary: {
    uploader: { destroy: async publicId => { calls.push(['destroy', publicId]); } },
    utils: { api_sign_request: () => 'test-signature' },
} } };
const router = require('../src/routes/profile');
const payload = { resumeUrl: `https://res.cloudinary.com/test/raw/upload/v1/devtinder/resumes/${candidateId}-new.pdf`, resumeFileName: 'Resume.pdf',
    resumePublicId: `devtinder/resumes/${candidateId}-new.pdf` };

test('resume version changes even when replacing the same filename', () => {
    assert.notEqual(createResumeUpdate(payload).resumeDocumentId, createResumeUpdate(payload).resumeDocumentId);
    assert.throws(() => createResumeUpdate({ ...payload, resumeFileName: 'resume.exe' }));
    assert.throws(() => createResumeUpdate({ ...payload, resumeUrl: 'javascript:alert(1)' }));
});

test('old citations are rejected after replacement and deletion', () => {
    const current = { ...payload, resumeDocumentId: 'new' };
    assert.equal(sourceMatchesCurrentResume({ ...payload, fileName: 'Resume.pdf', documentId: 'old' }, current), false);
    assert.equal(sourceMatchesCurrentResume({ fileName: 'Resume.pdf', documentId: 'new' }, current), true);
    assert.equal(sourceMatchesCurrentResume({ fileName: 'Resume.pdf', documentId: 'new' }, {}), false);
});

test('deleting a resume only requests cleanup, with no ingestion or AI calls', async () => {
    const routes = [];
    await notifyResumeService({ _id: candidateId }, async (url, options) => {
        routes.push(url); assert.deepEqual(JSON.parse(options.body), { candidateId }); return { ok: true };
    });
    assert.equal(routes.length, 1); assert.ok(routes[0].endsWith('/api/ingestion/cleanup'));
});

test('upload and deletion routes save first and never clean up on failed save', async t => {
    const app = express(); app.use(express.json()); app.use(router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const originalUpdate = User.findOneAndUpdate;
    const originalFetch = global.fetch;
    let failSave = false;
    User.findOneAndUpdate = async (filter, update, options) => {
        calls.push(['save']); assert.equal(options.new, true);
        if (failSave) throw new Error('save failed');
        if (update.$set) { assert.equal(options.runValidators, true); return { ...user, ...update.$set }; }
        const cleared = { ...user };
        Object.keys(update.$unset).forEach(key => delete cleared[key]);
        return cleared;
    };
    global.fetch = async (url, options) => {
        if (url.startsWith(base)) return originalFetch(url, options);
        calls.push([url.endsWith('/cleanup') ? 'cleanup' : 'ingest']); return { ok: true };
    };
    t.after(async () => { User.findOneAndUpdate = originalUpdate; global.fetch = originalFetch;
        await new Promise(resolve => server.close(resolve)); });
    const send = (method, body) => fetch(base + '/profile/resume', { method,
        headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

    user = { _id: candidateId }; calls = [];
    assert.equal((await send('PATCH', payload)).status, 200);
    assert.equal(calls[0][0], 'save'); assert.ok(!calls.some(([name]) => name === 'destroy'));
    assert.deepEqual(calls.map(([name]) => name), ['save', 'cleanup', 'ingest']);

    user = { _id: candidateId, resumePublicId: `devtinder/resumes/${candidateId}-old.pdf`, resumeUrl: 'https://example.test/old.pdf' };
    calls = []; failSave = true;
    assert.equal((await send('PATCH', payload)).status, 500);
    assert.deepEqual(calls, [['save']]);

    calls = []; failSave = false;
    assert.equal((await send('PATCH', payload)).status, 200);
    assert.equal(calls[0][0], 'save'); assert.ok(calls.some(([name]) => name === 'destroy'));

    calls = [];
    assert.equal((await send('DELETE')).status, 200);
    assert.equal(calls[0][0], 'save'); assert.ok(calls.some(([name]) => name === 'cleanup'));
    assert.ok(!calls.some(([name]) => name === 'ingest'));
});
