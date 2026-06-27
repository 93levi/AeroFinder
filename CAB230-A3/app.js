require('dotenv').config();

const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');

app.use(express.json());

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const rentalsRouter = require('./routes/rentals');
const usersRouter = require('./routes/users');
const ratingsRouter = require('./routes/ratings');

app.use('/rentals', rentalsRouter);
app.use('/user', usersRouter);
app.use('/ratings', ratingsRouter);

app.listen(3000, () => {
  console.log('HTTP server running on port 3000');
});

const httpsOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem')
};

https.createServer(httpsOptions, app).listen(3001, () => {
  console.log('HTTPS server running on port 3001');
});