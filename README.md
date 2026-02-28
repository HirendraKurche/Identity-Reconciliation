# Identity Reconciliation Service

A web service that links different customer orders made with different contact information (emails and phone numbers) to the same person.

## 🌐 Live Endpoint

**Base URL**: `https://identity-reconciliation-06us.onrender.com`  
**Endpoint**: `POST /identify`

> ⚠️ Free Render instances spin down after inactivity — the first request may take ~30 seconds.

---

## ✨ Features

- **Interactive Landing Page** — A polished dark-mode UI at `GET /` to test the API directly from your browser
- **Swagger API Docs** — Full OpenAPI 3.0 documentation at `GET /api-docs`
- **Identity Reconciliation Engine** — Smart contact linking via `POST /identify`
- **Zod Input Validation** — Type-safe, strict request body validation with detailed error messages
- **Prisma Atomic Transactions** — Merge-two-primaries logic runs inside `$transaction` for data integrity
- **Global Error Handler** — Centralized middleware catches `ZodError` (400) and generic errors (500)
- **CORS Enabled** — Frontend-friendly API access from any origin

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma (with interactive transactions)
- **Database**: PostgreSQL (Neon)
- **Validation**: Zod
- **Docs**: Swagger UI + swagger-jsdoc
- **Styling**: Tailwind CSS (CDN)

---

## API Reference

### `POST /identify`

Identifies and reconciles customer contacts based on email and/or phone number.

**Request Body** (JSON):
```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

> **Note**: At least one of `email` or `phoneNumber` must be provided.

**Response** (`200 OK`):
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123", "456"],
    "secondaryContactIds": [2, 3]
  }
}
```

### Example Requests

**1. New Customer**
```bash
curl -X POST https://identity-reconciliation-06us.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"123456"}'
```

**2. Link New Info to Existing Contact**
```bash
curl -X POST https://identity-reconciliation-06us.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"789012"}'
```

---

## Business Logic

| Scenario | Behavior |
|----------|----------|
| **New customer** | Creates a `primary` contact |
| **Partial match** | Creates a `secondary` contact linked to the existing primary |
| **Two primaries match** | Merges — older stays primary, newer becomes secondary |
| **All info exists** | No new rows; returns the consolidated cluster |

---

## Project Structure

```
bitespeedBackend/
├── public/
│   └── index.html            # Landing page + interactive API form
├── prisma/
│   └── schema.prisma         # Database schema
├── src/
│   ├── index.ts              # Express server entry point
│   ├── swagger.ts            # OpenAPI/Swagger spec
│   ├── prismaClient.ts       # Prisma client instance
│   ├── schemas/
│   │   └── identify.ts       # Zod validation schema
│   ├── middleware/
│   │   └── errorHandler.ts   # Global error-handling middleware
│   └── routes/
│       └── identify.ts       # POST /identify route handler
├── package.json
└── tsconfig.json
```

---

## Local Development

```bash
# Install dependencies
npm install

# Set up your database URL in .env
# DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Push schema to database
npx prisma db push

# Start the development server
npm run dev
```

The server runs on `http://localhost:3000` by default.

| Route | Description |
|-------|-------------|
| `GET /` | Interactive landing page with API test form |
| `GET /api-docs` | Swagger UI documentation |
| `POST /identify` | Identity reconciliation endpoint |

---

## Architecture & Algorithmic Approach

### The Problem as a Graph

Identity reconciliation is fundamentally a **connected-components problem** in an implicit graph:

```
  Contact A ──(shared email)── Contact B ──(shared phone)── Contact C
      │                                                        │
      └───────── These three belong to the same person ────────┘
```

- **Nodes** = individual contact records (rows in the `Contact` table).
- **Edges** = shared email addresses or phone numbers between records.
- **Clusters** = connected components — all contacts reachable via shared info belong to the same person.

Each cluster has exactly **one primary contact** (the oldest by `createdAt`), and all others are **secondary contacts** linked to it via `linkedId`.

### Algorithm Walkthrough

```
INPUT: { email?, phoneNumber? }

1. MATCH    → Find all contacts where email = input OR phone = input     O(n)
2. RESOLVE  → Collect the unique primary IDs from matching contacts       O(m)
3. BRANCH:
   ├─ 0 primaries → CREATE new primary contact (new customer)            O(1)
   ├─ 1 primary   → Use it as root                                      O(1)
   └─ 2+ primaries → MERGE: oldest stays primary, others demoted         O(k)
4. CLUSTER  → Fetch full cluster (root + all secondaries)                O(n)
5. EXTEND   → If incoming info is new, create a secondary contact        O(1)
6. RESPOND  → Build consolidated arrays (primary info first)             O(m)
```

| Variable | Meaning |
|----------|----------|
| `n` | Total contacts in the database |
| `m` | Contacts in the matched cluster |
| `k` | Secondaries being re-linked during a merge |

### Database Query Complexity

| Query | Complexity | Notes |
|-------|-----------|-------|
| `findMany` (match by email/phone) | `O(n)` → `O(log n)` with indexes | Index on `email` and `phoneNumber` recommended |
| `findMany` (fetch cluster) | `O(m)` | Bounded by cluster size |
| `updateMany` (merge primaries) | `O(k)` | `k` = secondaries of demoted primaries |
| `create` (new contact) | `O(1)` | Single insert |

### Data Integrity: Prisma Transactions

The **merge-two-primaries** scenario involves two dependent writes:
1. Demote newer primaries → secondary (`linkPrecedence = "secondary"`, `linkedId = rootPrimaryId`)
2. Re-link all their secondaries → point to the surviving primary

If the server crashes between step 1 and step 2, the hierarchy becomes corrupted. We prevent this with a **Prisma interactive transaction**:

```typescript
await prisma.$transaction(async (tx) => {
    await tx.contact.updateMany({ ... }); // Demote primaries
    await tx.contact.updateMany({ ... }); // Re-link secondaries
});
// Both succeed or both roll back — guaranteed.
```

### Type-Safe Input Boundaries: Zod

All incoming requests are validated at the boundary using **Zod** before any database queries run:

```typescript
const { email, phoneNumber } = identifySchema.parse(req.body);
```

- `email` → must be a valid email string (or omitted)
- `phoneNumber` → string or number (auto-coerced to string)
- At least one field required (`superRefine` cross-field validation)
- Invalid input throws `ZodError` → caught by global error handler → `400` response with structured details

---

## Deployment on Render

1. Push this repo to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Create a **PostgreSQL** database on Render
4. Set the `DATABASE_URL` environment variable to the PostgreSQL **Internal Database URL**
5. Set build command: `npm install && npx prisma migrate deploy && npm run build`
6. Set start command: `npm run start`
7. Deploy!
