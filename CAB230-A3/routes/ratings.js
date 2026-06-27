const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: true, message: 'Authorization header is malformed' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: true, message: err.name === 'TokenExpiredError' ? 'JWT token has expired' : 'Invalid JWT token' });
    req.user = decoded;
    next();
  });
}

router.post('/debugEraseRatings', async (req, res) => {
  try {
    await db('ratings').del();
    res.json({ message: 'All ratings successfully erased.' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.post('/rentals/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: true, message: 'Invalid rating. Rating must be an integer value between 1 and 5.' });
  }

  if (comment !== undefined && (typeof comment !== 'string' || comment.length < 1 || comment.length > 2000)) {
    return res.status(400).json({ error: true, message: 'Invalid comment parameter. Comment must be a string 1-2000 characters long.' });
  }

  try {
    const rental = await db('data').where({ id }).first();
    if (!rental) return res.status(404).json({ error: true, message: 'No rental exists with this ID.' });

    const existing = await db('ratings').where({ rentalId: id, userEmail: req.user.email }).first();
    if (existing) {
      await db('ratings').where({ rentalId: id, userEmail: req.user.email }).update({ rating, comment: comment || null });
    } else {
      await db('ratings').insert({ userEmail: req.user.email, rentalId: id, rating, comment: comment || null });
    }

    const saved = await db('ratings').where({ rentalId: id, userEmail: req.user.email }).first();
    const response = { rating: saved.rating, dateTime: saved.dateTime };
    if (saved.comment) response.comment = saved.comment;
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/rentals/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await db('ratings').where({ rentalId: id, userEmail: req.user.email }).first();
    if (!row) return res.status(404).json({ error: true, message: 'No rating exists with this rental ID.' });
    const response = { rating: row.rating, dateTime: row.dateTime };
    if (row.comment) response.comment = row.comment;
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = 20;
  const offset = (page - 1) * perPage;

  try {
    const totalRow = await db('ratings').where({ userEmail: req.user.email }).count('id as count').first();
    const total = parseInt(totalRow.count);
    const lastPage = Math.ceil(total / perPage);

    const rows = await db('ratings').where({ userEmail: req.user.email }).orderBy('dateTime', 'desc').limit(perPage).offset(offset);

    const data = rows.map(r => {
      const item = { rentalId: r.rentalId, rating: r.rating, dateTime: r.dateTime };
      if (r.comment) item.comment = r.comment;
      return item;
    });

    res.json({
      data,
      pagination: {
        total,
        lastPage,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < lastPage ? page + 1 : null,
        perPage,
        currentPage: page,
        from: offset,
        to: offset + perPage
      }
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;