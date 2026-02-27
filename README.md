# Identity Reconciliation Service

A web service that links different customer orders made with different contact information (emails and phone numbers) to the same person.

## 🌐 Live Endpoint

**Base URL**: `https://your-app-name.onrender.com`  
**Endpoint**: `POST /identify`

> Replace the above URL with your actual Render deployment URL.

---

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL

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
curl -X POST https://your-app-name.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","phoneNumber":"123456"}'
```

**2. Link New Info to Existing Contact**
```bash
curl -X POST https://your-app-name.onrender.com/identify \
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

## Local Development

```bash
# Install dependencies
npm install

# Set up your database URL in .env
# DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Run migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

The server runs on `http://localhost:3000` by default.

---

## Deployment on Render

1. Push this repo to GitHub
2. Create a **Web Service** on [render.com](https://render.com)
3. Create a **PostgreSQL** database on Render
4. Set the `DATABASE_URL` environment variable to the PostgreSQL **Internal Database URL**
5. Set build command: `npm install && npx prisma migrate deploy && npx prisma generate`
6. Set start command: `npm run start`
7. Deploy!
