# 🔍 AI Search Engine — Backend

A Perplexity-style AI search engine backend built with **Node.js + Express + TypeScript**, powered by **Gemini 2.5 Flash**, **Tavily Web Search**, **Supabase Auth**, and **PostgreSQL via Prisma**.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| AI Model | Gemini 2.5 Flash (Google GenAI) |
| Web Search | Tavily API |
| Auth | Supabase Auth (GitHub / Google OAuth) |
| Database | PostgreSQL (via Prisma ORM) |
| DB Hosting | Supabase |
| Deployment | Render |

---

## Project Structure

```
back/
├── index.ts                  # Entry point — starts the server
├── lib/
│   ├── client.ts             # Supabase client instance
│   ├── keepAlive.ts          # Cron job — keeps Supabase from pausing
│   └── prisma.ts             # Prisma client instance
├── middleware/
│   └── middleware.ts         # Auth middleware (Supabase JWT verification)
├── prisma/
│   ├── migrations/           # DB migration history
│   └── schema.prisma         # Database schema
├── prompt/
│   └── prompt.ts             # LLM prompt templates
├── routes/
│   ├── ask.ts                # POST /ask, POST /ask/followup
│   └── conversations.ts      # GET/DELETE /conversation routes
├── server/
│   └── server.ts             # Express app setup + route mounting
├── tests/
│   └── backend.test.ts       # Vitest test suite
├── types/                    # Shared TypeScript types
├── .env                      # Environment variables (never commit)
├── .env.example              # Example env file
├── package.json
├── prisma.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://...         # Supabase pooler URL (for Prisma)
DIRECT_URL=postgresql://...           # Supabase direct URL (for migrations)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # Supabase → Settings → API (never expose on frontend)
GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
PORT=3000
```

> ⚠️ Always use `SUPABASE_SERVICE_ROLE_KEY` on the backend, not the anon key. The service role key allows secure server-side JWT verification.

---

## Authentication Flow

Auth is handled entirely by **Supabase on the frontend**. The backend only verifies the token.

```
1. User logs in via GitHub/Google on the frontend (Supabase handles OAuth)
2. Supabase returns a JWT token to the frontend
3. Frontend sends that token on every request:
   Authorization: Bearer <token>
4. Backend middleware calls supabase.auth.getUser(token)
5. Supabase validates the JWT (signature, expiry, active session)
6. If valid → user is looked up in DB, created if first time
7. req.userId is set and the request continues
8. If invalid → 401 Unauthorized is returned
```

All protected routes require the `Authorization: Bearer <token>` header.

---

## Architecture Overview

```
Frontend (Vercel)
   │
   ├── tokens + query ──→ Backend (Render)
   │                          ├──→ Tavily API       (web search)
   │                          ├──→ Gemini API        (AI answer, streamed)
   │                          └──→ Supabase DB       (save conversations)
   │
   └── login/signup ──→ Supabase Auth (Google / GitHub OAuth)
```

---

## Keep-Alive Strategy

Both **Render** (free tier) and **Supabase** (free tier) go to sleep after inactivity.

| Service | Problem | Fix |
|---|---|---|
| Render | Spins down after 15 min of no traffic | UptimeRobot pings `/health` every 5 min |
| Supabase | Pauses after 7 days of no DB activity | `keepAlive.ts` runs a SELECT query every 24hrs via `node-cron` |

Set up a free monitor at [uptimerobot.com](https://uptimerobot.com) pointing to:
```
https://your-app.onrender.com/health
```

---

## Database Schema

```
User
  id            String   (Supabase UUID)
  name          String
  email         String   (unique)
  provider      GitHub | Google
  conversations Conversation[]

Conversation
  id        String   (cuid)
  title     String   (first 100 chars of the query)
  userId    String
  messages  Message[]
  createdAt DateTime

Message
  id             String
  content        String
  sources        Json?    (array of { url, title })
  role           USER | ASSISTANT
  conversationId String
  createdAt      DateTime

SearchCache
  id        String
  query     String   (unique — cache key)
  results   Json     (Tavily results)
  createdAt DateTime
  expiresAt DateTime (TTL: 1 hour default)
```

---

## API Reference

### Base URL
```
http://localhost:3000
```

### Auth Header (required on all protected routes)
```
Authorization: Bearer <supabase_jwt_token>
```

---

### `GET /health`
Health check endpoint. Used by UptimeRobot to keep Render awake.

```json
{ "status": "ok" }
```

---

### `POST /ask`

Main search endpoint. Searches the web, streams an AI answer, then appends sources.

**Auth required:** ✅

**Request:**
```json
{ "query": "What is quantum computing?" }
```

**Response (streamed):**
```
Quantum computing is a type of computation that...

<SOURCES>
[{"url":"https://example.com","title":"What is Quantum Computing"}]
</SOURCES>

<CONV_ID>clx1abc23def</CONV_ID>
```

**Errors:**
```json
{ "error": "Query is required" }       // 400
{ "error": "No token provided" }       // 401
{ "error": "Unauthorized" }            // 401
{ "error": "Something went wrong" }    // 500
```

---

### `POST /ask/followup`

Follow-up on an existing conversation. Sends full history to Gemini as context.

**Auth required:** ✅

**Request:**
```json
{
  "conversationId": "clx1abc23def",
  "query": "Can you explain qubits in more detail?"
}
```

**Response:** Same streamed format as `/ask` (without `<CONV_ID>`).

**Errors:**
```json
{ "error": "conversationId and query are required" }   // 400
{ "error": "Conversation not found" }                  // 404
{ "error": "Forbidden" }                               // 403
```

---

### `GET /conversations`

All conversations for the logged-in user, newest first. Includes first message as preview.

**Auth required:** ✅

**Response:**
```json
{
  "conversations": [
    {
      "id": "clx1abc23def",
      "title": "What is quantum computing?",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "messages": [{ "content": "What is quantum computing?", "role": "USER" }]
    }
  ]
}
```

---

### `GET /conversation/:conversationId`

Single conversation with all messages, oldest first.

**Auth required:** ✅

**Errors:**
```json
{ "error": "Conversation not found" }   // 404
{ "error": "Forbidden" }               // 403
```

---

### `DELETE /conversation/:conversationId`

Delete a conversation and all its messages.

**Auth required:** ✅

**Response:**
```json
{ "message": "Deleted successfully" }
```

---

## Caching

Search results are cached in the `SearchCache` table to avoid redundant Tavily API calls.

| Step | Behaviour |
|---|---|
| Query arrives | Check DB for exact query match |
| Cache hit + not expired | Return cached results, skip Tavily |
| Cache miss or expired | Call Tavily, store results with new TTL |
| Default TTL | 1 hour |

To change TTL, update in `routes/ask.ts`:
```typescript
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (first time)
npx prisma db push

# Start dev server
npm run dev
```

---

## Running Tests

```bash
npm test           # run once
npm run test:watch # watch mode
npm run coverage   # coverage report
```

---

## Quick Test with curl

```bash
# Replace TOKEN with a real Supabase JWT

# Health check
curl http://localhost:3000/health

# Ask a question
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"query": "What is quantum computing?"}' \
  --no-buffer

# Get all conversations
curl http://localhost:3000/conversations \
  -H "Authorization: Bearer TOKEN"

# Get a single conversation
curl http://localhost:3000/conversation/clx1abc23def \
  -H "Authorization: Bearer TOKEN"

# Ask a follow-up
curl -X POST http://localhost:3000/ask/followup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"conversationId": "clx1abc23def", "query": "Tell me more about qubits"}' \
  --no-buffer

# Delete a conversation
curl -X DELETE http://localhost:3000/conversation/clx1abc23def \
  -H "Authorization: Bearer TOKEN"
```