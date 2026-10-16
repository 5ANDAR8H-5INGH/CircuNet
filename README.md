# CircuNet industrial by-product exchange

CircuNet helps companies publish by-products, define buyer requirements, identify potential material matches, review separate feasibility estimates, and manage exchange requests. The current application uses the repository's existing React, Express, and PostgreSQL stack.

## MVP workflow

1. Register a company account and sign in.
2. Publish an available by-product listing.
3. A buyer saves material, quantity, location, distance, processing-cost, and optional quality requirements.
4. A supplier checks compatible buyers for a listing. Feasible matches are ranked by straight-line distance, nearest first. Listings that fail material, quality, quantity, or maximum-distance checks are excluded.
5. Review logistics, economic, and environmental estimates separately, including their assumptions.
6. A feasible match can send an exchange request. The supplier can accept it, and either party can cancel a pending request.

Compatibility uses curated category and material-name rules with optional numeric quality ranges. A match does not establish chemical or industrial safety. Environmental and economic values are estimates, not verified savings.

## Database setup

Create a PostgreSQL database, then run the schema and MVP migration in order:

```sh
psql -d circular_economy_marketplace -f server/src/database/schema.sql
psql -d circular_economy_marketplace -f server/src/database/mvp-migration.sql
```

The first script creates the existing application schema. The second adds buyer requirements and estimate snapshots needed by the MVP.

## Backend

Create `server/.env` with the database connection and a private JWT secret:

```env
PORT=8080
DB_USER=postgres
DB_HOST=localhost
DB_NAME=circular_economy_marketplace
DB_PASSWORD=your-local-password
DB_PORT=5432
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
NODE_ENV=development
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
```

Rate limits stay enabled in every environment. If the global values are omitted, development uses 1,000 requests per IP per 15 minutes and other environments use 300. Login and registration have a separate limit: 100 per 15 minutes in development and 20 otherwise. Set `NODE_ENV=production` in the deployment environment and override these values to match the expected traffic and hosting platform. If the API sits behind a reverse proxy, set `TRUST_PROXY_HOPS` to the number of trusted proxy hops (commonly `1`) so client IP limits work correctly; leave it unset when requests connect directly.

The analysis defaults can be overridden with `TRANSPORT_COST_PER_TONNE_KM`, `TRANSPORT_EMISSIONS_KG_PER_TONNE_KM`, `AVOIDED_DISPOSAL_COST_PER_KG`, and `AVOIDED_DISPOSAL_CO2_KG_PER_KG`. Economic rates have illustrative defaults. CO2e estimates stay unavailable until both emission factors are configured. Replace illustrative values with documented, locally appropriate factors before real-world use.

```sh
cd server
npm install
npm run dev
```

The API listens on port 8080 by default. Set `VITE_API_URL` in `client/.env` only when the API is hosted somewhere other than `http://localhost:8080`.

## Frontend

```sh
cd client
npm install
npm run dev
```

## Main API routes

- `GET /api/listings`, `GET /api/listings/:id`, authenticated listing create/list/close routes
- `POST /api/auth/register`, `POST /api/auth/login`, authenticated `GET /api/auth/me`
- Authenticated `GET/POST /api/requirements`, `PUT /api/requirements/:id`, and `DELETE /api/requirements/:id`
- Authenticated `GET /api/matches/:listingId`
- Authenticated `GET/POST /api/transactions` and `PATCH /api/transactions/:id/status`

Protected routes use `Authorization: Bearer <token>`.
