const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const taskRoutes = require('./routes/taskRoutes');
const cafeAreaRoutes = require('./routes/cafeAreaRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const focusRoutes = require('./routes/focusRoutes');
const focusSessionRoutes = require('./routes/focusSessionRoutes');
const menuItemRoutes = require('./routes/menuItemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(requestLogger);

app.use('/api/health', healthRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/cafe-areas', cafeAreaRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/focus-sessions', focusSessionRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/orders', orderRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
