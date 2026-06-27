const express = require('express');
const router = express.Router();
const db = require('../db');

function isNonNegativeInteger(val) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 0;
}

router.get('/states', async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    const params = Object.keys(req.query).join(', ');
    return res.status(400).json({ error: true, message: `Invalid query parameters: ${params}. Query parameters are not permitted.` });
  }
  try {
    const rows = await db('data').distinct('state').orderBy('state', 'asc');
    res.json(rows.map(row => row.state));
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/property-types', async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    const params = Object.keys(req.query).join(', ');
    return res.status(400).json({ error: true, message: `Invalid query parameters: ${params}. Query parameters are not permitted.` });
  }
  try {
    const rows = await db('data').distinct('propertyType').orderBy('propertyType', 'asc');
    res.json(rows.map(row => row.propertyType));
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/search', async (req, res) => {
  const {
    suburb, state, postcode,
    minimumRent, maximumRent,
    minimumBathrooms, maximumBathrooms,
    minimumBedrooms, maximumBedrooms,
    minimumParking, maximumParking,
    propertyTypes, minimumRating, maximumRating,
    sortBy, sortOrder, page
  } = req.query;

  if (postcode !== undefined && (!isNonNegativeInteger(postcode) || Number(postcode) > 9999)) {
    return res.status(400).json({ error: true, message: 'Invalid postcode parameter. Must be an integer in the range of 0000-9999.' });
  }
  if (minimumRent !== undefined && !isNonNegativeInteger(minimumRent)) {
    return res.status(400).json({ error: true, message: 'Invalid minimumRent parameter. Must be a non-negative integer.' });
  }
  if (maximumRent !== undefined && !isNonNegativeInteger(maximumRent)) {
    return res.status(400).json({ error: true, message: 'Invalid maximumRent parameter. Must be a non-negative integer.' });
  }
  if (minimumBathrooms !== undefined && !isNonNegativeInteger(minimumBathrooms)) {
    return res.status(400).json({ error: true, message: 'Invalid minimumBathrooms parameter. Must be a non-negative integer.' });
  }
  if (maximumBathrooms !== undefined && !isNonNegativeInteger(maximumBathrooms)) {
    return res.status(400).json({ error: true, message: 'Invalid maximumBathrooms parameter. Must be a non-negative integer.' });
  }
  if (minimumBedrooms !== undefined && !isNonNegativeInteger(minimumBedrooms)) {
    return res.status(400).json({ error: true, message: 'Invalid minimumBedrooms parameter. Must be a non-negative integer.' });
  }
  if (maximumBedrooms !== undefined && !isNonNegativeInteger(maximumBedrooms)) {
    return res.status(400).json({ error: true, message: 'Invalid maximumBedrooms parameter. Must be a non-negative integer.' });
  }
  if (minimumParking !== undefined && !isNonNegativeInteger(minimumParking)) {
    return res.status(400).json({ error: true, message: 'Invalid minimumParking parameter. Must be a non-negative integer.' });
  }
  if (maximumParking !== undefined && !isNonNegativeInteger(maximumParking)) {
    return res.status(400).json({ error: true, message: 'Invalid maximumParking parameter. Must be a non-negative integer.' });
  }
  if (page !== undefined && (!isNonNegativeInteger(page) || Number(page) < 1)) {
    return res.status(400).json({ error: true, message: 'Invalid page parameter. Must be an integer greater than or equal to 1.' });
  }

  const validSortFields = ['id', 'title', 'rent', 'propertyType', 'latitude', 'longitude', 'postcode', 'state', 'suburb', 'bathrooms', 'bedrooms', 'parkingSpaces', 'averageRating', 'numRatings'];
  if (sortBy !== undefined && !validSortFields.includes(sortBy)) {
    return res.status(400).json({ error: true, message: 'Invalid sortBy parameter. Must refer to a valid sortable property.' });
  }
  if (sortOrder !== undefined && !['asc', 'desc'].includes(sortOrder)) {
    return res.status(400).json({ error: true, message: "Invalid sortOrder parameter. Must be 'asc' or 'desc'." });
  }
  if (sortOrder !== undefined && sortBy === undefined) {
    return res.status(400).json({ error: true, message: 'Invalid sortOrder parameter. sortBy must be specified.' });
  }

  const pageNum = parseInt(page) || 1;
  const perPage = 10;
  const offset = (pageNum - 1) * perPage;

  try {
    let query = db('data');

    if (suburb) query = query.where('suburb', 'like', `%${suburb}%`);
    if (state) query = query.where({ state });
    if (postcode) query = query.where({ postcode });
    if (minimumRent) query = query.where('rent', '>=', minimumRent);
    if (maximumRent) query = query.where('rent', '<=', maximumRent);
    if (minimumBathrooms) query = query.where('bathrooms', '>=', minimumBathrooms);
    if (maximumBathrooms) query = query.where('bathrooms', '<=', maximumBathrooms);
    if (minimumBedrooms) query = query.where('bedrooms', '>=', minimumBedrooms);
    if (maximumBedrooms) query = query.where('bedrooms', '<=', maximumBedrooms);
    if (minimumParking) query = query.where('parkingSpaces', '>=', minimumParking);
    if (maximumParking) query = query.where('parkingSpaces', '<=', maximumParking);
    if (propertyTypes) {
      const types = Array.isArray(propertyTypes) ? propertyTypes : [propertyTypes];
      query = query.whereIn('propertyType', types);
    }

    const totalRow = await query.clone().count('id as count').first();
    const total = parseInt(totalRow.count);

    const validSortColumns = ['id', 'title', 'rent', 'propertyType', 'latitude', 'longitude', 'postcode', 'state', 'suburb', 'bathrooms', 'bedrooms', 'parkingSpaces'];

    let dataQuery = query.clone()
      .select('id', 'title', 'rent', 'propertyType', 'latitude', 'longitude', 'postcode', 'state', 'suburb', 'bathrooms', 'bedrooms', 'parkingSpaces')
      .limit(perPage)
      .offset(offset);

    if (sortBy && validSortColumns.includes(sortBy)) {
      dataQuery = dataQuery.orderBy(sortBy, sortOrder || 'asc');
    } else {
      dataQuery = dataQuery.orderBy('id', 'asc');
    }

    const rentals = await dataQuery;
    const ids = rentals.map(r => r.id);
    const ratingRows = ids.length > 0 ? await db('ratings').whereIn('rentalId', ids) : [];

    const ratingMap = {};
    for (const r of ratingRows) {
      if (!ratingMap[r.rentalId]) ratingMap[r.rentalId] = [];
      ratingMap[r.rentalId].push(r.rating);
    }

    let data = rentals.map(rental => {
      const ratings = ratingMap[rental.id] || [];
      const numRatings = ratings.length;
      const averageRating = numRatings > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / numRatings) * 100) / 100
        : null;
      return {
        ...rental,
        latitude: parseFloat(rental.latitude),
        longitude: parseFloat(rental.longitude),
        averageRating,
        numRatings
      };
    });

    if (minimumRating) data = data.filter(r => r.averageRating !== null && r.averageRating >= parseFloat(minimumRating));
    if (maximumRating) data = data.filter(r => r.averageRating !== null && r.averageRating <= parseFloat(maximumRating));
    if (sortBy === 'averageRating') data.sort((a, b) => sortOrder === 'desc' ? (b.averageRating || 0) - (a.averageRating || 0) : (a.averageRating || 0) - (b.averageRating || 0));
    if (sortBy === 'numRatings') data.sort((a, b) => sortOrder === 'desc' ? b.numRatings - a.numRatings : a.numRatings - b.numRatings);

    const lastPage = Math.ceil(total / perPage);

    res.json({
      data,
      pagination: {
        total,
        lastPage,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
        nextPage: pageNum < lastPage ? pageNum + 1 : null,
        perPage,
        currentPage: pageNum,
        from: offset,
        to: offset + data.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: true, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  if (Object.keys(req.query).length > 0) {
    const params = Object.keys(req.query).join(', ');
    return res.status(400).json({ error: true, message: `Invalid query parameters: ${params}. Query parameters are not permitted.` });
  }

  const { id } = req.params;

  try {
    const rental = await db('data').where({ id }).first();
    if (!rental) {
      return res.status(404).json({ error: true, message: 'No rental exists with this ID.' });
    }

    const ratingRows = await db('ratings').where({ rentalId: id });
    const numRatings = ratingRows.length;
    const averageRating = numRatings > 0
      ? Math.round((ratingRows.reduce((sum, r) => sum + r.rating, 0) / numRatings) * 100) / 100
      : null;

    const reviews = ratingRows.map(r => {
      const review = { rating: r.rating, user: r.userEmail, dateTime: r.dateTime };
      if (r.comment) review.comment = r.comment;
      return review;
    });

    res.json({
      ...rental,
      latitude: parseFloat(rental.latitude),
      longitude: parseFloat(rental.longitude),
      averageRating,
      numRatings,
      reviews
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;