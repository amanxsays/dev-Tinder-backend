const allowedOrigins = frontendOrigin => [...new Set([...(frontendOrigin || '').split(',').map(value => value.trim()).filter(Boolean), 'https://localhost'])];
const createCorsOptions = (frontendOrigin) => ({
  origin: allowedOrigins(frontendOrigin),
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Installation-Secret', 'X-Installation-Binding'],
  // Do not retain outdated permissions in the browser's preflight cache.
  maxAge: 0,
  optionsSuccessStatus: 204,
});

module.exports = { createCorsOptions, allowedOrigins };
