const { readFileSync } = require('node:fs');

function validateCredential(credential, projectId) {
    if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
        throw new Error('Supply the expected Firebase project ID through --project=PROJECT_ID.');
    }
    if (credential?.type !== 'service_account' || credential.project_id !== projectId ||
        typeof credential.client_email !== 'string' || !credential.client_email.endsWith('.gserviceaccount.com') ||
        typeof credential.private_key !== 'string' || !credential.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Credential is not a service-account key for the expected project.');
    }
}

async function verifyFcm({ credential, projectId, send }) {
    validateCredential(credential, projectId);
    // Always validation-only. Never expose a real-send option or target a device.
    await send({ topic: 'devtinder-setup-validation',
        data: { type: 'setup_validation' } }, true);
}

async function main() {
    const projectId = process.argv.find(arg => arg.startsWith('--project='))?.slice('--project='.length);
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!path) throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a private service-account JSON file outside Git.');
    let credential;
    try { credential = JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw new Error('Cannot read a valid credential JSON file; check GOOGLE_APPLICATION_CREDENTIALS.'); }
    validateCredential(credential, projectId);
    const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    let app;
    try {
        app = initializeApp({ credential: cert(credential), projectId }, 'devtinder-setup-validation');
        await verifyFcm({ credential, projectId, send: (message, dryRun) => getMessaging(app).send(message, dryRun) });
        console.log('PASS: Firebase accepted an FCM validation-only request. No notification was delivered.');
        console.log('Real device registration, delivery, permission, and tap behavior still require testing.');
    } catch (error) {
        // SDK messages may include credential details; print only an allowlisted code.
        const code = /^[a-z-]+\/[a-z0-9-]+$/.test(error.code || '') ? error.code : 'unavailable';
        throw new Error(`FCM validation failed (${code}). Check credential access, network, and the Firebase Cloud Messaging API.`);
    } finally { if (app) await deleteApp(app); }
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
module.exports = { validateCredential, verifyFcm };
