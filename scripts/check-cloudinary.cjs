require('dotenv').config({ quiet: true });
const { cloudinaryConfig } = require('../src/utils/cloudinaryConfig');
const cloudinary = require('cloudinary').v2;

(async () => {
    let config;
    try { config = cloudinaryConfig(); }
    catch { console.error('FAIL: configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET from the same active product environment.'); process.exitCode = 1; return; }
    cloudinary.config({ cloud_name: config.cloudName, api_key: config.apiKey, api_secret: config.apiSecret });
    try {
        const result = await cloudinary.api.ping({ timeout: 15000 });
        if (result.status !== 'ok') throw new Error('Unexpected health response');
        console.log('PASS: Cloudinary accepted the configured cloud/key pair. No files uploaded or deleted.');
    } catch (error) {
        const message = error.error?.message || error.message || '';
        const reason = /disabled/i.test(message) ? 'product environment disabled'
            : /unknown|invalid|unauthorized/i.test(message) ? 'invalid cloud/key pair' : 'provider or network failure';
        console.error(`FAIL: Cloudinary health check: ${reason}. Verify the active cloud and its matching key/secret in Render.`);
        process.exitCode = 1;
    }
})();
