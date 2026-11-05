function cloudinaryConfig(env = process.env) {
    const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName)
        || /^(undefined|null|cloud_name)$/i.test(cloudName) || !apiKey || !apiSecret) {
        throw new Error('Resume storage is not configured. Please contact support.');
    }
    return { cloudName, apiKey, apiSecret };
}
module.exports = { cloudinaryConfig };
