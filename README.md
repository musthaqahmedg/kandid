# Kandid

**See it. Report it.** Kandid lets citizens report civic problems (broken roads, garbage, water leaks, broken streetlights) with a live photo, GPS location and time, so the people responsible can be held to account.

> *Kandu* (കണ്ടു) means "saw it" in Malayalam. Kandid = *kandu* + *candid*.

## Features
- Email OTP login (no passwords)
- Report an issue: live camera photo, auto GPS + time, pin fine-tuning (max 200 m from live GPS, so reporters must be on the spot), category, note
- Public **list and map** of reports, coloured by status (Open → Acknowledged → Fixed)
- **"Open for X days" / "Fixed in X days"** on every report
- **Community-verified fixes**: people within 200 m confirm "It's fixed" (with an after photo) or "Still broken". Closes when the reporter or 3 people confirm; reopens if more people say it's still broken. The reporter can rate the fix.
- **On-device privacy blur**: faces (and heads of people further away) are detected in the browser with MediaPipe (BlazeFace + EfficientDet-Lite) and pixelated before upload; tap to blur anything else, like number plates. The original photo never leaves the phone.
- Before/after photos
- Installable on iPhone and Android as a web app (PWA)

Coming next: upvotes UI, share & file with official channels (PWD 4U, K-SMART, CM portal), moderation, Google sign-in, AI (auto category, face/number-plate blur), ward scorecards.

## How it works
- Counts and status are computed **server-side** by an Appwrite Function (`functions/kandid-sync`) triggered by database events, so users can't tamper with them.
- A vote only counts if it was really created by the user it names, was cast within 200 m, and (for "fixed") has an after photo.
- The rules are pure functions with unit tests (`npm test`), run in GitHub Actions on every push.

## Tech stack
- **Frontend:** Next.js (App Router) + React + TypeScript, PWA
- **Maps:** Leaflet + OpenStreetMap
- **Backend:** [Appwrite Cloud](https://appwrite.io): Auth (email OTP), TablesDB with geospatial points, Storage, Functions (Node 22)
- **Hosting:** Vercel (auto-deploy from `main`)
- **CI:** GitHub Actions (unit tests + type-check + build)
- Built with an AI coding agent

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

## License
MIT
