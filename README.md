# AeroFinder

A full-stack rental-property search application. Browse and filter listings,
view them on a map and in a 3D building visualisation, register/log in, and
leave ratings and reviews.

**Live demo:** https://aero-finder-rho.vercel.app

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, React Router, Three.js (3D building scene), Pigeon Maps |
| Backend | Node, Express, Knex |
| Database | MySQL |
| Auth | JWT (signed tokens) + bcrypt password hashing |

## Architecture

```
Browser ──HTTPS──> Frontend (Vercel) ──HTTPS──> REST API (Render) ──TLS──> MySQL (Aiven)
```

The frontend is a static SPA. It talks to the API at the URL given by the
`VITE_API_BASE` environment variable. The API is a stateless Express service
that reads/writes a managed MySQL database.

## Repository layout

```
/              React + Vite frontend (the deployed SPA)
/CAB230-A3     Express + MySQL backend API
/CAB230-A3/dump.sql   Full database dump (schema + data) for importing
```

## Local development

### 1. Backend

```bash
cd CAB230-A3
cp .env.example .env      # fill in DB credentials + JWT_SECRET
npm install
npm run dev               # http://localhost:3000  (API docs at /docs)
```

### 2. Frontend

```bash
npm install
npm run dev               # http://localhost:5173
```

With no `VITE_API_BASE` set, the dev server proxies `/api` to a backend on
`localhost:3000`, so the two run together out of the box.

## Deployment

- **Database** — create a managed MySQL (e.g. Aiven free tier) and import
  `CAB230-A3/dump.sql`.
- **Backend** — deploy `CAB230-A3` to Render. Set the env vars from
  `.env.example` (with `DB_SSL=true`). Render provides HTTPS automatically.
- **Frontend** — deploy the repo root to Vercel and set
  `VITE_API_BASE` to the Render API URL.

## API

The REST API is documented with Swagger UI at `/docs` on the running backend.
Key endpoints: `GET /rentals/search`, `GET /rentals/:id`,
`GET /rentals/states`, `GET /rentals/property-types`,
`POST /user/register`, `POST /user/login`, `GET/POST /ratings`.
