# MediLens Technical Overview

This document is a reference for the MediLens Express backend: its API surface, security model, and the defensive edge cases already built into the code.

---

## 1. API Endpoints

Base path for all routes: `/api`.

Authentication is required unless noted. Send the Supabase access token as:

```
Authorization: Bearer <access_token>
```

### 1.1 Health Check

| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/health` | No |

**Response**

```json
{ "status": "ok" }
```

---

### 1.2 Demo Login

| Method | Path | Auth |
|--------|------|------|
| POST   | `/api/demo/login` | No |

Logs in a hardcoded demo account and returns Supabase session tokens.

**Request**

```json
{}
```

**Response**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "expires_at": 1234567890,
  "user": { "id": "...", "email": "demo@medilens.app" }
}
```

---

### 1.3 Family Members

#### Create family member

| Method | Path | Auth |
|--------|------|------|
| POST   | `/api/family-members` | Yes |

**Request**

```json
{
  "name": "Jane Doe",
  "age": 34,
  "chronic_conditions": ["Hypertension", "Asthma"],
  "allergies": ["Penicillin"]
}
```

`chronic_conditions` and `allergies` also accept comma-separated strings.

**Response — 201**

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Jane Doe",
  "age": 34,
  "chronic_conditions": ["Hypertension", "Asthma"],
  "allergies": ["Penicillin"],
  "created_at": "2025-03-14T10:00:00Z"
}
```

---

#### List family members

| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/family-members` | Yes |

**Response**

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Jane Doe",
    "age": 34,
    "chronic_conditions": ["Hypertension"],
    "allergies": ["Penicillin"],
    "created_at": "2025-03-14T10:00:00Z"
  }
]
```

---

#### Delete family member

| Method | Path | Auth |
|--------|------|------|
| DELETE | `/api/family-members/:id` | Yes |

Cascades deletion to the member's documents (including storage objects) and vitals.

**Response — 204**

No body.

---

#### Get member timeline

| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/family-members/:id/timeline` | Yes |

Aggregates the member profile, documents with fresh signed URLs, vitals, and inferred current medications from extracted drug names.

**Response**

```json
{
  "member": { "id": "uuid", "name": "Jane Doe", "age": 34, ... },
  "items": [
    {
      "kind": "document",
      "id": "uuid",
      "occurred_at": "2025-03-14T10:00:00Z",
      "file_name": "prescription.pdf",
      "file_url": "https://...signed...",
      "extracted_summary": { "document_type": "prescription", ... }
    },
    {
      "kind": "vital",
      "id": "uuid",
      "occurred_at": "2025-03-14T00:00:00Z",
      "type": "blood_pressure",
      "value": "128/82",
      "source": "document"
    }
  ],
  "current_medications": ["Lisinopril"]
}
```

---

### 1.4 Documents

#### Upload document

| Method | Path | Auth |
|--------|------|------|
| POST   | `/api/documents/upload` | Yes |

Multipart/form-data with a single file field named `file` and a body field `family_member_id`. Supports images, PDF, and plain text up to 10 MB.

**Request**

```
POST /api/documents/upload
Content-Type: multipart/form-data

file: <binary>
family_member_id: uuid
```

**Response — 201**

```json
{
  "id": "uuid",
  "family_member_id": "uuid",
  "file_url": "https://...signed...",
  "file_name": "report.pdf",
  "storage_path": "user-id/member-id/timestamp-report.pdf",
  "extracted_summary": {
    "document_type": "lab report",
    "date": "2025-03-01",
    "key_findings": ["Glucose elevated"],
    "mentioned_drug_names": ["Metformin"],
    "blood_pressure": null,
    "blood_sugar": "142 mg/dL",
    "weight": null
  },
  "auto_vitals": [
    { "id": "uuid", "type": "blood_sugar", "value": "142 mg/dL", "date": "2025-03-01", "source": "document" }
  ]
}
```

---

#### Delete document

| Method | Path | Auth |
|--------|------|------|
| DELETE | `/api/documents/:id` | Yes |

Removes the storage object first, then deletes the database row.

**Response — 204**

No body.

---

### 1.5 Vitals

Valid types: `blood_pressure`, `blood_sugar`, `weight`.

#### Create vital

| Method | Path | Auth |
|--------|------|------|
| POST   | `/api/vitals` | Yes |

**Request**

```json
{
  "family_member_id": "uuid",
  "type": "blood_pressure",
  "value": "128/82",
  "date": "2025-03-14"
}
```

`date` defaults to today if omitted.

**Response — 201**

```json
{
  "id": "uuid",
  "family_member_id": "uuid",
  "type": "blood_pressure",
  "value": "128/82",
  "date": "2025-03-14",
  "created_at": "2025-03-14T10:00:00Z"
}
```

---

#### Update vital

| Method | Path | Auth |
|--------|------|------|
| PATCH  | `/api/vitals/:id` | Yes |

**Request**

```json
{
  "value": "130/85",
  "date": "2025-03-15"
}
```

**Response**

```json
{
  "id": "uuid",
  "family_member_id": "uuid",
  "type": "blood_pressure",
  "value": "130/85",
  "date": "2025-03-15",
  "created_at": "2025-03-14T10:00:00Z"
}
```

---

#### Delete vital

| Method | Path | Auth |
|--------|------|------|
| DELETE | `/api/vitals/:id` | Yes |

**Response — 204**

No body.

---

### 1.6 Medicine Search

#### Basic search

| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/medicine/search?query=...` | Yes |

Resolves the query through RxNorm, fetches the best openFDA label, and returns an AI-generated summary.

**Response — OK**

```json
{
  "status": "OK",
  "drug": {
    "genericName": "Lisinopril",
    "brandName": "Zestril",
    "substanceName": "Lisinopril",
    "label": { ... }
  },
  "summary": {
    "short_summary": ["Used to treat high blood pressure.", ...],
    "long_summary": "Lisinopril is an ACE inhibitor..."
  }
}
```

**Response — not found**

```json
{
  "status": "NOT_FOUND",
  "message": "No matching medication label found."
}
```

---

#### Search with safety filter

| Method | Path | Auth |
|--------|------|------|
| GET    | `/api/medicine/search-filtered?query=...&family_member_id=...` | Yes |

Same as basic search but adds a personalized safety verdict against the family member's conditions, allergies, and extracted current medications.

**Response**

```json
{
  "status": "OK",
  "drug": { ... },
  "summary": { ... },
  "safety": {
    "verdict": "CAUTION",
    "reasoning": "... This is not medical advice. Consult a physician.",
    "interaction_flagged": true
  }
}
```

---

## 2. Key Security Decisions

### 2.1 JWT Authentication Flow

The backend does not store sessions. Each request is authenticated with a Supabase JWT access token.

- `backend/middleware/auth.js` extracts `Authorization: Bearer <token>`.
- It calls `supabase.auth.getUser(token)` to validate the token with Supabase Auth.
- On success, `req.user` (the Supabase user object) and `req.token` are attached to the request.
- Routes use `requireAuth` middleware; unauthenticated or invalid-token requests receive `401 Unauthorized`.

Every per-request Supabase client is created with the user's own JWT via `getSupabaseForUser(req.token)`, so all subsequent Supabase calls run with that user's identity.

### 2.2 Row-Level Security (RLS)

RLS is enforced on all three application tables. The backend never bypasses policies; it relies on the authenticated Supabase client.

#### `family_members`

- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id`
- `DELETE`: `auth.uid() = user_id`

#### `documents`

- `SELECT/INSERT/UPDATE/DELETE`: via an ownership join to `family_members` where `family_members.user_id = auth.uid()`

#### `vitals_log`

- `SELECT/INSERT/UPDATE/DELETE`: via an ownership join to `family_members` where `family_members.user_id = auth.uid()`

This guarantees that even if a malicious UUID were supplied, a user can only read or mutate rows that belong to them.

### 2.3 Private Document Storage

- The Supabase Storage bucket `documents` is private. Direct public URLs are not used.
- On upload, the file is stored at `user-id/family-member-id/timestamp-filename`.
- The upload route stores only the `storage_path`, then creates a 1-hour signed URL (`createSignedUrl(storagePath, 3600)`) that is returned to the client.
- On timeline fetch, fresh 1-hour signed URLs are regenerated for all documents.
- On document or family-member deletion, the storage object is removed before the database row is deleted.

Because the bucket is private and the backend controls signed URL generation, files cannot be accessed without a valid token and ownership of the related family member.

---

## 3. Notable Edge Cases Already Handled

### 3.1 Authentication & Ownership

- Missing or malformed `Authorization` header returns `401`.
- `assertOwnedMember` checks that the requested `family_member_id` belongs to `req.user.id`; otherwise the route returns `404` (not `403`) to avoid leaking existence.
- All document/vital mutations first fetch the row, verify the related member is owned, then perform the operation.

### 3.2 File Uploads

- Multer uses in-memory storage with a 10 MB limit. Oversized files return `413 File too large (max 10 MB)`.
- Unsupported MIME types are rejected at extraction time; a text file fallback is still allowed.
- Storage upload failures roll back by deleting the partially uploaded storage object before returning `500`.

### 3.3 AI/Gemini Failures

- If `GEMINI_API_KEY` is missing, the backend falls back to deterministic text parsing for text documents and FDA-derived fallbacks for medicine search.
- Gemini extraction retries up to three times with exponential backoff on `429` quota errors before falling back.
- Malformed JSON responses from Gemini are caught, logged, and fall back to rule-based extraction or FDA label summaries.
- Safety and summarization calls always return a usable fallback (even if Gemini times out after 15 seconds or throws), so the user never sees a hard error for an AI-only feature.

### 3.4 Medicine Search Resilience

- RxNorm approximate search returns the first named candidate. If no candidate is found, the route returns `NOT_FOUND` instead of crashing.
- If no openFDA label is found for the generic name, the search falls back to the original brand/query name.
- The best label is selected by scoring fields (warnings, contraindications, dosage, etc.) so the most informative label is used.
- Safety verdicts are normalized to `SAFE`, `CAUTION`, or `UNSAFE`; any unexpected value defaults to `CAUTION`.

### 3.5 Duplicate Vitals Prevention

When a document is uploaded, `vitals_log` entries are auto-created for `blood_pressure`, `blood_sugar`, and `weight` if present in the extracted summary. Before insertion, the code checks whether an identical row already exists for the same member with the same `type`, `value`, and `date`. If it does, the insert is skipped.

### 3.6 Empty or Incomplete Data

- Empty patient profiles are explicitly flagged to the safety model, which then issues a general safety verdict and notes the missing context.
- Missing `chronic_conditions`, `allergies`, or `current_medications` are reported as "none documented" rather than being omitted.
- Empty timeline medication lists render as an empty array, not null.
- Document extraction returns `null` fields for missing values, and the PDF exporter falls back to "None documented" for empty sections.

### 3.7 Demo Account

The demo login route uses the Supabase anon key and signs in a hardcoded demo account. It returns real Supabase tokens, so the rest of the app treats the demo session exactly like a normal user session.

---

## 4. Environment Variables Used by the Backend

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key for client creation |
| `GEMINI_API_KEY` | Google Gemini API key for document extraction, summarization, and safety checks |
| `OPENFDA_API_KEY` | Optional API key for openFDA requests |

---

*Document generated from source review of the MediLens backend.*
