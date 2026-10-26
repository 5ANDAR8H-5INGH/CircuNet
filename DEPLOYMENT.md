# CircuNet deployment (Render free demo)

## 1. Database
Create a PostgreSQL database in Singapore on the Free plan. Note that Render free databases expire after 30 days.

## 2. API web service
Connect the GitHub repository `Venkateshpaitwar/CircuNet`. Configure: root directory `server`; build command `npm ci && npm run build`; start command `npm start`; health check path `/health`; instance plan Free. Add environment variables:

- `NODE_ENV=production`
- `DATABASE_URL` = the database internal connection URL
- `JWT_SECRET` = a private random secret of at least 32 characters
- `CORS_ORIGINS` = the frontend site origin (set after creating it)
- `TRUST_PROXY_HOPS=1`
- `RATE_LIMIT_MAX=300`
- `RATE_LIMIT_WINDOW_MS=900000`
- `AUTH_RATE_LIMIT_MAX=20`
- `AUTH_RATE_LIMIT_WINDOW_MS=900000`

## 3. Initialize database
Run `server/src/database/schema.sql` and then `server/src/database/mvp-migration.sql` exactly once against the new database, in that order. Do not rerun the schema on a populated database.

## 4. Frontend static site
Create a Render Static Site for the same repository. Set root directory `client`; build command `npm ci && npm run build`; publish directory `dist`; plan Free. Set `VITE_API_URL` to the API service URL, without a trailing slash.

## 5. CORS and smoke check
After the static site has a URL, set API `CORS_ORIGINS` to its exact HTTPS origin and redeploy the API. Verify `https://<api-host>/health`, then try registration/login, creating a listing and requirement, checking compatible matches, and submitting/accepting an exchange request.

Free web services may sleep while idle, so the first request can be slow. Replace illustrative economic and emissions factors with documented values before using estimates for real d
