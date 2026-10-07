const express = require("express");

const router = express.Router();

router.get("/", (_request, response) => {
  response.status(200).json({ status: "ok", service: "cafe-tempo-api" });
});

module.exports = router;
