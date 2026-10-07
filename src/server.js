require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");
const resumeRewardBreaks = require("./utils/resumeRewardBreaks");
const mongoose = require("mongoose");

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Cafe Tempo API listening on http://localhost:${port}`);
    });
    const breakCheck = setInterval(() => {
      resumeRewardBreaks().catch((error) =>
        console.error("Could not check expired reward breaks:", error),
      );
    }, 5000);
    breakCheck.unref();

    let shuttingDown = false;
    async function shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`${signal} received. Closing Cafe Tempo API.`);
      clearInterval(breakCheck);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  })
  .catch((error) => {
    console.error(`Could not start Cafe Tempo API: ${error.message}`);
    process.exitCode = 1;
  });
