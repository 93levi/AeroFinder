require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

// Allow the deployed frontend to call this API from another origin.
// JWTs are sent in the Authorization header (not cookies), so a simple
// open CORS policy is safe. Lock it down with CORS_ORIGIN if you prefer.
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Lightweight health check (no DB hit) — used by Render and the uptime
// pinger that keeps the free instance from sleeping.
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.json({ status: 'ok', docs: '/docs' }));

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const rentalsRouter = require('./routes/rentals');
const usersRouter = require('./routes/users');
const ratingsRouter = require('./routes/ratings');

app.use('/rentals', rentalsRouter);
app.use('/user', usersRouter);
app.use('/ratings', ratingsRouter);

// Render injects PORT; default to 3000 for local development.
// TLS is terminated by the platform (Render), so we only serve HTTP here.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
