const mongoose = require("mongoose");
const Task = require("../models/Task");

module.exports = function ownData(Model) {
  return async (request, response, next) => {
    try {
      const userId = String(request.user._id);
      for (const value of [request.query.user, request.body?.user]) {
        if (value !== undefined && value !== userId) {
          return response
            .status(403)
            .json({ message: "You can only access your own cafe data." });
        }
      }
      Object.defineProperty(request, "query", {
        value: { ...request.query, user: userId },
        configurable: true,
      });
      if (request.method === "POST")
        request.body = { ...request.body, user: userId };

      const id = request.path.split("/")[1];
      if (Model && mongoose.isObjectIdOrHexString(id)) {
        const record = await Model.findOne({ _id: id, user: userId }).select(
          "_id",
        );
        if (!record)
          return response.status(404).json({ message: "Record not found" });
      }
      if (request.body?.task !== undefined) {
        if (!mongoose.isObjectIdOrHexString(request.body.task)) {
          return response.status(400).json({ message: "Invalid task ID" });
        }
        const task = await Task.findOne({
          _id: request.body.task,
          user: userId,
        }).select("_id");
        if (!task)
          return response.status(404).json({ message: "Task not found" });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
