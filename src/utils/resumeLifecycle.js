const { randomUUID } = require('node:crypto');

// Updating only these fields avoids validating unrelated, older profile data.
function resumeVersionFilter(user) {
    return { _id: user._id, resumePublicId: user.resumePublicId || { $in: [null, ''] } };
}

function createResumeUpdate({ resumeUrl, resumeFileName, resumePublicId }) {
    if (![resumeUrl, resumeFileName, resumePublicId].every(value => typeof value === 'string' && value.trim())) {
        throw new Error('Missing resume details.');
    }
    const url = new URL(resumeUrl);
    if (url.protocol !== 'https:' || url.username || url.password || !/\.pdf$/i.test(resumeFileName)) {
        throw new Error('A valid PDF resume URL and filename are required.');
    }
    return { resumeUrl, resumeFileName, resumePublicId, resumeDocumentId: randomUUID() };
}

async function notifyResumeService(user, fetchImpl = fetch) {
    const baseUrl = (process.env.STATS_SERVICE_URL || 'http://localhost:8080').replace(/\/$/, '');
    const payload = { candidateId: user._id.toString() };
    async function post(route, body) {
        const response = await fetchImpl(`${baseUrl}/api/ingestion/${route}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) throw new Error(`Resume ${route} failed (HTTP ${response.status})`);
    }
    // Cleanup contains no embedding or LLM calls. A failed cleanup must not prevent new ingestion.
    try { await post('cleanup', payload); }
    catch (error) { console.error('Resume cleanup will be retried by integration service:', error.message); }
    if (user.resumeUrl) {
        await post('process', { ...payload, fileUrl: user.resumeUrl,
            fileName: user.resumeFileName, documentId: user.resumeDocumentId });
    }
}

function sourceMatchesCurrentResume(source, user) {
    if (!user?.resumeUrl || source.fileName !== user.resumeFileName) return false;
    if (user.resumeDocumentId) return source.documentId === user.resumeDocumentId;
    return source.fileUrl === user.resumeUrl;
}

module.exports = { resumeVersionFilter, createResumeUpdate, notifyResumeService, sourceMatchesCurrentResume };
