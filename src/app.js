const express = require("express");
const cors = require("cors");
const healthRoutes = require("./routes/healthRoutes");
const taskRoutes = require("./routes/taskRoutes");
const cafeAreaRoutes = require("./routes/cafeAreaRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const focusRoutes = require("./routes/focusRoutes");
const focusSessionRoutes = require("./routes/focusSessionRoutes");
const menuItemRoutes = require("./routes/menuItemRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const authenticate = require("./middleware/authenticate");
const ownData = require("./middleware/ownData");

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(requestLogger);
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api", authenticate);
app.use("/api/tasks", ownData(require("./models/Task")), taskRoutes);
app.use("/api/cafe-areas", cafeAreaRoutes);
app.use("/api/reservations", ownData(require("./models/Reservation")), reservationRoutes);
app.use("/api/focus", ownData(), focusRoutes);
app.use("/api/focus-sessions", ownData(require("./models/FocusSession")), focusSessionRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/orders", ownData(require("./models/Order")), orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rewards", ownData(), require("./routes/rewardRoutes"));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
