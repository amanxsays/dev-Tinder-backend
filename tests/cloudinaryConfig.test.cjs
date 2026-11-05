const test = require('node:test');
const assert = require('node:assert/strict');
const { cloudinaryConfig } = require('../src/utils/cloudinaryConfig');
const valid = { CLOUDINARY_CLOUD_NAME: 'fixture-cloud', CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-secret' };
test('upload signing rejects absent or placeholder cloud credentials before returning a broken URL', () => {
    for (const key of Object.keys(valid)) assert.throws(() => cloudinaryConfig({ ...valid, [key]: '' }), /not configured/);
    for (const cloud of ['undefined', 'null', 'cloud_name', 'https://cloudinary.com', '"fixture"']) {
        assert.throws(() => cloudinaryConfig({ ...valid, CLOUDINARY_CLOUD_NAME: cloud }), /not configured/);
    }
});
test('validated config trims values and never includes secret text in errors', () => {
    assert.equal(cloudinaryConfig({ ...valid, CLOUDINARY_CLOUD_NAME: ' fixture-cloud ' }).cloudName, 'fixture-cloud');
    assert.throws(() => cloudinaryConfig({ ...valid, CLOUDINARY_CLOUD_NAME: '' }), error => !error.message.includes(valid.CLOUDINARY_API_SECRET));
});
