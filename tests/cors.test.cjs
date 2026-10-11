const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const { createCorsOptions } = require('../src/utils/corsOptions');

test('browser preflights allow profile PATCH and resume DELETE with credentials', async t => {
    const app = express();
    app.use(cors(createCorsOptions('http://localhost:5173')));
    app.use(express.json());
    app.patch('/profile/edit', (req, res) => res.json({ updated: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [path, method] of [['/profile/resume', 'PATCH'], ['/profile/edit', 'PATCH'], ['/profile/resume', 'DELETE']]) {
        const response = await fetch(base + path, { method: 'OPTIONS', headers: {
            Origin: 'http://localhost:5173', 'Access-Control-Request-Method': method,
            'Access-Control-Request-Headers': 'content-type',
        } });
        assert.equal(response.status, 204);
        assert.ok(response.headers.get('access-control-allow-methods').split(',').includes(method));
        assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
        assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
        assert.equal(response.headers.get('access-control-max-age'), '0');
    }
    const saved = await fetch(base + '/profile/edit', { method: 'PATCH',
        headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { updated: true });
    const otherOrigin = await fetch(base + '/profile/edit', { method: 'OPTIONS', headers: {
        Origin: 'https://unconfigured.example', 'Access-Control-Request-Method': 'PATCH',
    } });
    assert.notEqual(otherOrigin.headers.get('access-control-allow-origin'), 'https://unconfigured.example');
});
