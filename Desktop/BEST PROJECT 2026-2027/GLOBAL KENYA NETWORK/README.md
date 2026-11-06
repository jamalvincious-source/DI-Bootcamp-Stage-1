# Global Network Kenya

The frontend and backend are separate applications:

- Frontend: the static pages, styles, and `js/app.js` files. Serve the project root with a static web server such as VS Code Live Server.
- Backend: the Express API in `js/backend/crc/`, listening on port 3000 by default. It does not serve frontend files.
- Database: PostgreSQL, accessed by the backend through Prisma.

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string and `JWT_SECRET` to a unique secret of at least 32 characters. For a hosted database that requires TLS, include `sslmode=require` in `DATABASE_URL`.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Generate Prisma Client and synchronize the database schema:

   ```sh
   npm run prisma:generate
   npm run db:push
   ```

   These use the Prisma schema at `js/backend/crc/prisma/schema.prisma` and the `DATABASE_URL` from `.env`. `npm run db:setup` only checks the PostgreSQL connection; it does not create tables.
4. Start the API with `npm run dev` or `npm start`.
5. Separately serve this project directory (the folder containing `index.html`) as the frontend; do not serve its parent workspace folder. The default frontend API address is `http://localhost:3000/api`; set `window.GNK_API_BASE_URL` before loading `js/app.js` to use another API address.

The API includes health checks, registration/login/current-user and password recovery, business directory and submissions, marketplace listings, adverts, advertising packages, payments, and administrator endpoints. Data operations use Prisma Client.

New registrations are saved as user records in PostgreSQL and sign in immediately. Authentication uses an HttpOnly session cookie; choosing “Keep me signed in” extends the login to 30 days. Logging out clears the server-side cookie.

Signed-in user dashboards show their own advert submissions, currently published network adverts, and published adverts from Real Estate businesses. Property cards include images and descriptions, open the advertiser’s listing when a safe HTTP or HTTPS destination is provided, and show the Global Network Kenya contact number 0118 237749.

The login page also links to password-free User, Advertiser, and Super Admin dashboard previews. These previews use sample data only and do not authenticate or modify real accounts. The advertiser demo includes sample campaign, package, performance, and billing details; creating a campaign adds a local demo draft only. Its RIOBA showcase images are original illustrations, not real customer testimonials or campaign results.

The API health check is available at `http://localhost:3000/api/health`.

## Deploy to Render

The `render.yaml` Blueprint creates a static frontend, an Express API, and a persistent PostgreSQL database. The API uses Render's free web-service plan, which may sleep when idle; the PostgreSQL database uses Render's paid `basic-256mb` plan.

1. Push this project to the `jamalvincious-source/DI-Bootcamp-Stage-1` GitHub repository. This project is in `Desktop/BEST PROJECT 2026-2027/GLOBAL KENYA NETWORK`.
2. In Render, choose **New → Blueprint**, connect the repository, and set **Blueprint Path** to `Desktop/BEST PROJECT 2026-2027/GLOBAL KENYA NETWORK/render.yaml`. Review Render's current prices before confirming the paid database.
3. After the services are created, open the API service's environment settings and set `FRONTEND_BASE_URL` to the HTTPS URL of the static site. Configure any optional email or Super Admin variables there as needed; never commit secrets.
4. Open the static site URL. Its build uses the API service hostname to configure frontend API requests.

The API service generates `JWT_SECRET` automatically and synchronizes the Prisma schema at startup. The database is persistent; back it up before making schema changes.
