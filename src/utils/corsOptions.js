const createCorsOptions = (frontendOrigin) => ({
  origin: frontendOrigin,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // Do not retain outdated permissions in the browser's preflight cache.
  maxAge: 0,
  optionsSuccessStatus: 204,
});

module.exports = { createCorsOptions };
