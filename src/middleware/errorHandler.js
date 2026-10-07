function errorHandler(error, request, response, next) {
  console.error(error);

  if (error.name === "ValidationError") {
    return response.status(400).json({ message: error.message });
  }

  if (error.name === "CastError") {
    return response.status(400).json({ message: "Invalid ID or field value" });
  }

  if (error.code === 11000) {
    return response
      .status(400)
      .json({ message: "A record with that unique value already exists" });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return response.status(400).json({ message: "Invalid JSON body" });
  }

  response.status(500).json({ message: "Internal server error" });
}

module.exports = errorHandler;
