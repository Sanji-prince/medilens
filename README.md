# MediLens

**A family health record vault that turns uploaded medical documents into structured, searchable data — and checks new medicines against your family's real conditions, allergies, and current medications.**

MediLens lets you upload prescriptions, lab reports, and scan documents for each family member, uses Gemini AI to extract key findings, dates, drug names, and vitals from them, and builds a unified health timeline per person. When you look up a medicine, it pulls the official FDA drug label and runs an AI-assisted safety check personalized to the selected family member's profile.

---

## Features

### Family Health Records
- **Family member profiles** — name, age, chronic conditions (e.g. diabetes, hypertension), and allergies
- **Document upload** — PDFs, images (JPG/PNG), and text files up to 10 MB, stored in a private Supabase Storage bucket and served via expiring signed URLs
- **AI document extraction** — Gemini reads each uploaded document and extracts document type, date, key findings, mentioned drug names, and vitals (blood pressure, blood sugar, weight); plain-text files fall back to a regex-based extractor when Gemini is unavailable or quota-exhausted
- **Auto-extracted vitals** — blood pressure, blood sugar, and weight found in documents are automatically logged to the member's vitals history, tagged "From document" and de-duplicated so re-uploads don't create repeats
- **Unified timeline** — documents and vitals merged into one chronology per member, with extracted summaries rendered inline
- **Document management** — download with original filename, zoomable image viewer (scroll/pinch zoom + drag panning) for JPG/PNG, and delete
- **Vitals tracking** — manually log blood pressure, blood sugar, and weight; edit value/date inline or delete any entry
- **Current medications** — automatically derived from drug names detected across a member's documents

### Medicine Search & Safety Audit
- **Medicine lookup** — resolves a search term to a generic drug name via RxNorm, then pulls the official FDA drug label from openFDA
- **Plain-language summary** — Gemini summarizes the FDA label into bullet points and a layperson paragraph
- **Personalized safety verdict** — checks a medicine against a family member's current medications, chronic conditions, and allergies, returning **SAFE / CAUTION / UNSAFE** with reasoning; flags when an interaction risk is mentioned
- **Graceful degradation** — if Gemini is unavailable, summaries fall back to structured FDA-label excerpts and safety checks return a precautionary CAUTION verdict

### Platform
- **Email/password authentication** with JWT sessions and automatic token refresh
- **One-click demo account** (`demo@medilens.app`) seeded with sample family data, reachable from the landing page
- **Row-Level Security** — every database row is scoped to its owning account, enforced by both Supabase RLS policies and backend ownership middleware
- **Responsive UI** — public landing page, dashboard, member profiles, and medicine search all work on mobile and desktop
- **Docker support** — one-command startup of backend + frontend

---

## Architecture

MediLens is a three-tier app: a React SPA, a stateless Express REST API, and Supabase (Postgres + Auth + Storage). All AI and third-party drug-data calls happen server-side.

```
                        ┌──────────────────────────────────────────────┐
                        │                  Browser                     │
                        │  React 19 SPA (Vite + Tailwind CSS v4)       │
                        │  Landing · Login · Dashboard · Family        │
                        │  Profile (timeline) · Medicine Search        │
                        └───────────────┬──────────────────────────────┘
                                        │ fetch /api/*  (Bearer JWT
                                        │ from Supabase session)
                                        ▼
                        ┌──────────────────────────────────────────────┐
                        │           Express REST API (port 5000)       │
                        │  requireAuth → verify JWT via Supabase       │
                        │  assertOwnedMember → ownership checks        │
                        │                                              │
                        │  /api/family-members   CRUD + timeline       │
                        │  /api/documents        upload / delete       │
                        │  /api/vitals           create / edit /       │
                        │                        delete                │
                        │  /api/medicine         search + safety       │
                        │  /api/demo             demo login            │
                        └───┬──────────┬──────────┬──────────┬─────────┘
                            │          │          │          │
              ┌─────────────▼──┐  ┌────▼─────┐  ┌─▼──────┐  ┌▼───────────┐
              │    Supabase    │  │  Gemini  │  │ RxNorm │  │   openFDA  │
              │  ─ Auth (JWT)  │  │   API    │  │ (RxNav)│  │ drug labels│
              │  ─ Postgres    │  │ document │  │ name   │  │            │
              │    + RLS       │  │ extract, │  │ resolu-│  │            │
              │  ─ Storage     │  │ summary, │  │ tion   │  │            │
              │  (documents    │  │ safety   │  │        │  │            │
              │   bucket)      │  │ checks   │  │        │  │            │
              └────────────────┘  └──────────┘  └────────┘  └────────────┘
```

**Request flow example — uploading a document:**

1. The browser `POST`s the file to `/api/documents/upload` with the user's Supabase JWT.
2. `requireAuth` verifies the JWT with Supabase Auth; `assertOwnedMember` confirms the family member belongs to this user.
3. The file is stored in the private `documents` Supabase Storage bucket under `{userId}/{memberId}/{timestamp}-{filename}`.
4. Gemini extracts the summary (document type, date, key findings, drug names, vitals); the result is saved as JSONB on the `documents` row.
5. Any vitals found in the extraction are automatically inserted into `vitals_log` with `source: 'document'` (de-duplicated on family member + type + value + date).
6. The browser refreshes the timeline, which re-signs storage URLs (1-hour expiry) and merges documents + vitals into one sorted feed.

**Data model** (`supabase-schema.sql`):

| Table | Purpose |
|---|---|
| `family_members` | One row per person: name, age, `chronic_conditions text[]`, `allergies text[]`, owner `user_id` |
| `documents` | Uploaded files: name, storage path, `extracted_summary jsonb` (Gemini output) |
| `vitals_log` | BP / blood sugar / weight readings: value, date, `source` (`manual` \| `document`), optional `document_id` link |

All three tables have Row-Level Security policies keyed to `auth.uid()`, so users can only ever read or write their own family's rows.

---

## External APIs

All third-party services used by MediLens have a free tier; no paid API is required.

| Service | Used for | Key required? | Free tier |
|---|---|---|---|
| **Supabase** | Auth, Postgres database, file storage | Yes — project URL + anon key | Yes (free plan includes 2 projects, 500 MB database, 1 GB storage) |
| **Google Gemini API** | Document extraction, medicine summaries, safety verdicts (model: `gemini-3.6-flash`) | Yes — API key | Yes (free tier with rate limits; app degrades gracefully when quota is hit) |
| **openFDA** | Official FDA drug labeling data | No — optional API key raises rate limits | Yes (public, no key needed) |
| **RxNorm / RxNav** (NIH) | Resolving brand/colloquial names to generic drug names | No | Yes (public, no key needed) |

RxNorm and openFDA responses are cached in memory for 5 minutes to stay well within public rate limits.

---

## Setup

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project
- A free [Google AI Studio](https://aistudio.google.com/) API key (optional — the app works without it, with reduced AI features)

### 1. Configure Supabase

1. Create a Supabase project.
2. In the **SQL Editor**, run the contents of [`supabase-schema.sql`](supabase-schema.sql). This creates the `family_members`, `documents`, and `vitals_log` tables with RLS policies.
3. If your `vitals_log` table already existed, also run the migration lines in section 4b of that file (adds the `source` and `document_id` columns).
4. In **Storage**, create a bucket named `documents` and keep it **private** (signed URLs are generated by the backend; never make it public).

### 2. Environment variables

Create a `.env` file at the **repo root** (the backend loads it from `../.env`):

```env
# Required
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>

# Optional — enables AI extraction, summaries, and safety checks
GEMINI_API_KEY=<your-gemini-api-key>

# Optional — raises openFDA rate limits
OPENFDA_API_KEY=<your-openfda-api-key>

# Optional — backend port (default 5000)
# PORT=5000
```

Create a `frontend/.env` file for the frontend (values are baked in at build/dev time by Vite):

```env
# Required — same values as above
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Optional — backend URL used by the dev-server proxy (default http://localhost:5000)
# VITE_API_URL=http://localhost:5000
```

### 3. Run locally

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the backend, so no CORS configuration is needed locally.

### 4. (Optional) Seed the demo account

To enable the **Try Demo** button on the landing page:

1. In Supabase **Authentication → Users**, create a user with email `demo@medilens.app` and password `demo123456`.
2. Copy that user's UUID into the `demo_user_id` variable at the top of [`supabase-seed.sql`](supabase-seed.sql), then run the script in the SQL Editor.

This seeds two family members (Asha Kapoor with diabetes/hypertension history, and Rohan Kapoor) with sample vitals.

### 5. Run with Docker

```bash
docker compose up --build
```

- Backend: http://localhost:5000
- Frontend: http://localhost:5173 (built and served via Vite preview inside the container)

Both services read the same root `.env` variables through `docker-compose.yml`.

---

## Project Structure

```
medilens/
├── backend/
│   ├── server.js              # Express app entry, route mounting
│   ├── supabaseClient.js      # Per-request Supabase client factory
│   ├── middleware/
│   │   ├── auth.js            # JWT verification via Supabase Auth
│   │   └── ownership.js       # Family-member ownership checks
│   └── routes/
│       ├── familyMembers.js   # CRUD + unified timeline endpoint
│       ├── documents.js       # Upload, Gemini extraction, auto-vitals, delete
│       ├── vitals.js          # Create, edit (PATCH), delete
│       ├── medicine.js        # RxNorm + openFDA + Gemini summary/safety
│       └── demo.js            # Demo account login
├── frontend/
│   └── src/
│       ├── pages/             # Landing, Login, Dashboard, FamilyProfile,
│       │                      # MedicineSearch
│       ├── components/        # Layout, Icons, ProtectedRoute
│       ├── context/           # Auth context (Supabase session)
│       └── lib/               # api client (token refresh), supabase, format
├── supabase-schema.sql        # Tables + RLS policies
├── supabase-seed.sql          # Demo account seed data
└── docker-compose.yml         # backend + frontend services
```

---
---

## Future Plans

- **Search history** — log each medicine search per family member for quick recall
- **PDF health summary export** — one-tap doctor-ready summary (conditions, allergies, vitals, recent docs)
- **Vitals range flagging** — auto-flag out-of-range BP/sugar readings in the timeline
- **Multi-language support** — beyond English-only
- **Push/email reminders** — medication schedules, follow-up dates
- **Wider AI fallback coverage** — expand the non-Gemini extraction path to PDFs and images, not just plain text

---
## Disclaimer — Not Medical Advice

MediLens is a personal record-keeping and information tool. **It is not a medical device and does not provide medical advice, diagnosis, or treatment.**

- Safety verdicts (SAFE / CAUTION / UNSAFE), summaries, and extracted document data are AI-generated and may be incomplete, outdated, or wrong. They are **not** a substitute for professional judgment.
- Always read the actual medication label and **consult a qualified physician or pharmacist** before starting, stopping, or changing any medication — especially if a verdict of CAUTION or UNSAFE is shown, or if an interaction is flagged.
- Do not rely on MediLens in an emergency. If you or a family member experiences a medical emergency, contact your local emergency services immediately.
- Keep the original documents; extracted summaries are convenience views, not authoritative records.

Use of openFDA and RxNorm data is subject to their respective terms; drug label content belongs to its publishers. You are responsible for how you use the information MediLens presents.
