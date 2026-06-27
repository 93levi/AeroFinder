const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function formatDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.substring(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) { req.user = null; return next(); }
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, message: 'Authorization header is malformed' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: true, message: 'Authorization header is malformed' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ error: true, message: 'JWT token has expired' });
      return res.status(401).json({ error: true, message: 'Invalid JWT token' });
    }
    req.user = decoded;
    next();
  });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: true, message: "Authorization header ('Bearer token') not found" });
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: true, message: 'Authorization header is malformed' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: true, message: 'Authorization header is malformed' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') return res.status(401).json({ error: true, message: 'JWT token has expired' });
      return res.status(401).json({ error: true, message: 'Invalid JWT token' });
    }
    req.user = decoded;
    next();
  });
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Request body incomplete, both email and password are required' });
  }
  try {
    const existing = await db('users').where({ email }).first();
    if (existing) return res.status(409).json({ error: true, message: 'User already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await db('users').insert({ email, password: hashedPassword });
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Request body incomplete, both email and password are required' });
  }
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: true, message: 'Incorrect email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: true, message: 'Incorrect email or password' });
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, tokenType: 'Bearer', expiresIn: 86400 });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.post('/debugLogin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: true, message: 'Request body incomplete, both email and password are required' });
  }
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: true, message: 'Incorrect email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: true, message: 'Incorrect email or password' });
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1s' });
    res.json({ token, tokenType: 'Bearer', expiresIn: 1 });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/:email/profile', optionalAuth, async (req, res) => {
  const { email } = req.params;
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(404).json({ error: true, message: 'User not found' });

    if (req.user && req.user.email === email) {
      return res.json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dob: formatDate(user.dob),
        address: user.address
      });
    }

    return res.json({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.put('/:email/profile', requireAuth, async (req, res) => {
  const { email } = req.params;

  if (req.user.email !== email) {
    return res.status(403).json({ error: true, message: 'Forbidden' });
  }

  const { firstName, lastName, dob, address } = req.body;

  if (!firstName || !lastName || !dob || !address) {
    return res.status(400).json({ error: true, message: 'Request body incomplete: firstName, lastName, dob and address are required.' });
  }

  if (typeof firstName !== 'string' || typeof lastName !== 'string' || typeof address !== 'string') {
    return res.status(400).json({ error: true, message: 'Request body invalid: firstName, lastName and address must be strings only.' });
  }

  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(dob)) {
    return res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
  }

  const [year, month, day] = dob.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  if (parsedDate.getFullYear() !== year || parsedDate.getMonth() + 1 !== month || parsedDate.getDate() !== day) {
    return res.status(400).json({ error: true, message: 'Invalid input: dob must be a real date in format YYYY-MM-DD.' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsedDate >= today) {
    return res.status(400).json({ error: true, message: 'Invalid input: dob must be a date in the past.' });
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(404).json({ error: true, message: 'User not found' });

    await db('users').where({ email }).update({ firstName, lastName, dob, address });
    const updated = await db('users').where({ email }).first();

    res.json({
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      dob: formatDate(updated.dob),
      address: updated.address
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;