const { timingSafeEqual } = require('node:crypto');
function verifiedPhoto(body, userId, config, cloudinary) {
    const { publicId, version, signature, format } = body || {};
    if (typeof publicId !== 'string' || !publicId.startsWith('devtinder/avatars/' + userId + '-')
        || !/^[a-zA-Z0-9_/-]+$/.test(publicId) || !Number.isSafeInteger(version) || version < 1
        || !['jpg', 'jpeg', 'png', 'webp'].includes(format) || !/^[a-f0-9]{40}$/.test(signature || '')) throw new Error('Invalid photo upload');
    const expected = cloudinary.utils.api_sign_request({ public_id: publicId, version }, config.apiSecret);
    if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error('Unverified photo upload');
    return cloudinary.url(publicId, { cloud_name: config.cloudName, secure: true, resource_type: 'image', version, format });
}
module.exports = { verifiedPhoto };
