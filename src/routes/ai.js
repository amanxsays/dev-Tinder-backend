const express = require('express');
const http = require('node:http');
const https = require('node:https');
const { userAuth } = require('../middleware/auth');
const { serviceAssertion } = require('../utils/serviceAssertion');

function createAiRouter({ authenticate = userAuth, getBaseUrl = () => process.env.STATS_SERVICE_URL || 'http://localhost:8080',
    assertion = serviceAssertion, request, timeoutMs = 130000 } = {}) {
    const router = express.Router();
    router.post('/ai/chat/stream', authenticate, (req, res) => {
        const { query } = req.body || {};
        if (typeof query !== 'string' || !query.trim() || query.length > 16000) {
            return res.status(400).json({ message: 'Query must contain 1 to 16000 characters.' });
        }
        let upstream;
        let timer;
        const cleanup = () => { clearTimeout(timer); };
        const fail = (status = 503) => {
            cleanup();
            if (!res.headersSent) res.status(status).json({ message: 'AI service is unavailable. Please try again.' });
            else if (!res.writableEnded) res.destroy();
        };
        try {
            const url = new URL('/api/chat/stream', getBaseUrl());
            if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
                throw new Error('Unsafe AI service configuration.');
            }
            const payload = JSON.stringify({ query, userId: String(req.user._id) });
            const transport = request || (url.protocol === 'https:' ? https.request : http.request);
            upstream = transport(url, { method: 'POST', headers: {
                'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
                Accept: 'text/event-stream', ...assertion(String(req.user._id), query),
            } }, incoming => {
                if (incoming.statusCode !== 200 || !String(incoming.headers['content-type']).includes('text/event-stream')) {
                    incoming.resume();
                    // Upstream authentication authenticates our service, not the user's session.
                    // Never tell a correctly authenticated client to discard its login for this failure.
                    fail([400, 429, 503].includes(incoming.statusCode) ? incoming.statusCode : 503);
                    return;
                }
                res.status(200).set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
                    'X-Accel-Buffering': 'no' });
                res.flushHeaders();
                incoming.on('error', () => fail());
                incoming.on('end', cleanup);
                incoming.pipe(res);
            });
            upstream.on('error', () => fail());
            timer = setTimeout(() => { upstream.destroy(); fail(504); }, timeoutMs);
            timer.unref?.();
            req.on('aborted', () => { cleanup(); upstream.destroy(); });
            res.on('close', () => { cleanup(); upstream.destroy(); });
            upstream.end(payload);
        } catch { upstream?.destroy(); fail(); }
    });
    return router;
}
module.exports = createAiRouter();
module.exports.createAiRouter = createAiRouter;
