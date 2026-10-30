# Kandid

**See it. Report it.** Kandid lets citizens report civic problems (broken roads, garbage, water leaks, broken streetlights) with a live photo, GPS location and time, so the people responsible can be held to account.

> *Kandu* (കണ്ടു) means "saw it" in Malayalam. Kandid = *kandu* + *candid*.

## Features (v1)
- Email OTP login (no passwords)
- Report an issue: live camera photo, auto GPS pin and capture time, category, note
- Public feed of reports with status (Open → Acknowledged → Fixed)
- Installable on iPhone and Android as a web app (PWA)

Coming next: map view, upvotes, Google sign-in, AI issue detection, auto-tagging the responsible ward/MLA.

## Tech stack
- **Frontend:** Next.js (App Router) + TypeScript
- **Backend:** [Appwrite Cloud](https://appwrite.io) (Auth, TablesDB with geospatial points, Storage)
- **Hosting:** Vercel / Appwrite Sites (free tier)

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## License
MIT
