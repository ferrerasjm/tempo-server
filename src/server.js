require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Cafe Tempo API listening on http://localhost:${port}`);
    });
  })
  .catch(error => {
    console.error(`Could not start Cafe Tempo API: ${error.message}`);
    process.exitCode = 1;
  });
