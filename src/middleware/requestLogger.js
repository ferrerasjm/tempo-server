function requestLogger(request, response, next) {
  console.log(`${new Date().toISOString()} ${request.method} ${request.originalUrl}`);
  next();
}

module.exports = requestLogger;
