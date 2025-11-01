const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable development server in production
config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url.includes('/status')) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({packager_status: 'running', root: __dirname}));
        return;
      }
      middleware(req, res, next);
    };
  }
};

module.exports = config;