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
| Hosting DB | Supabase |

---

## Project Structure

```
src/
├── server.ts          # All API routes
├── middleware.ts       # Auth middleware (Supabase token verification)
├── prompt.ts          # LLM prompt templates
└── lib/
    ├── prisma.ts      # Prisma client instance
    └── client.ts      # Supabase client instance
prisma/
└── schema.prisma      # Database schema
```

---

## Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://...        # Supabase pooler URL (for Prisma)
DIRECT_URL=postgresql://...          # Supabase direct URL (for migrations)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # From Supabase → Settings → API (never expose on frontend)
GEMINI_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
PORT=3000
```

> ⚠️ Use `SUPABASE_SERVICE_ROLE_KEY` on the backend, not the anon key. The service role key lets the backend verify user tokens securely.

---

## Authentication Flow

Auth is handled entirely by **Supabase on the frontend**. The backend only verifies the token.

```
1. User logs in via GitHub/Google on the frontend (Supabase handles this)
2. Supabase gives the frontend a JWT token
3. Frontend sends that token in every request:
   Authorization: Bearer <token>
4. Backend middleware calls supabase.auth.getUser(token)
5. Supabase validates the JWT (signature, expiry, active session)
6. If valid → user is looked up in our DB, created if first time
7. req.userId is set and the request continues
8. If invalid → 401 Unauthorized is returned
```

All protected routes require the `Authorization: Bearer <token>` header.

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
  query     String   (unique — used as cache key)
  results   Json     (Tavily results)
  createdAt DateTime
  expiresAt DateTime (TTL: 1 hour by default)
```

---

## API Reference

### Base URL

```
http://localhost:3000
```

---

### Auth Header (required on all protected routes)

```
Authorization: Bearer <supabase_jwt_token>
```

---

### `POST /ask`

**Main search endpoint.** Takes a query, searches the web, streams an AI answer, then sends sources.

**Auth required:** ✅ Yes

**Request body:**
```json
{
  "query": "What is quantum computing?"
}
```

**Response (streamed):**

The response streams in two parts:

```
Part 1 — AI answer (plain text, streamed chunk by chunk):
Quantum computing is a type of computation that...

Part 2 — Sources appended at the end:
<SOURCES>
[{"url":"https://example.com","title":"What is Quantum Computing"}]
</SOURCES>
```

**How to read it on the frontend:**
- Stream the response body
- Split on `\n<SOURCES>\n` to separate the answer from sources
- Parse the sources block as JSON

**Caching:** If the same query was asked within the last hour, Tavily is skipped and cached results are used. The conversation and messages are saved to the database after streaming completes.

**Errors:**
```json
{ "error": "Query is required" }          // 400 — empty query
{ "error": "No token provided" }          // 401 — missing auth header
{ "error": "Unauthorized" }               // 401 — invalid/expired token
{ "error": "Something went wrong" }       // 500 — server error
```

---

### `POST /ask/followup`

**Follow-up question on an existing conversation.** Sends the full conversation history to the AI as context, then streams a new answer.

**Auth required:** ✅ Yes

**Request body:**
```json
{
  "conversationId": "clx1abc23def",
  "query": "Can you explain the qubit part in more detail?"
}
```

**Response (streamed):** Same format as `/ask` — streamed AI answer followed by `<SOURCES>` block.

**Behavior:**
- Loads all previous messages from the conversation
- Does a fresh Tavily search for the new query (with caching)
- Sends conversation history + new search results to Gemini
- Streams the answer back
- Saves the new USER + ASSISTANT messages to the existing conversation

**Errors:**
```json
{ "error": "conversationId and query are required" }   // 400
{ "error": "Conversation not found" }                  // 404
{ "error": "Forbidden" }                               // 403 — not your conversation
```

---

### `GET /conversations`

**Get all conversations for the logged-in user**, ordered newest first. Includes the first message of each as a preview.

**Auth required:** ✅ Yes

**Response:**
```json
{
  "conversations": [
    {
      "id": "clx1abc23def",
      "title": "What is quantum computing?",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "userId": "uuid-from-supabase",
      "messages": [
        {
          "id": "clx1msg001",
          "content": "What is quantum computing?",
          "role": "USER",
          "sources": null,
          "createdAt": "2024-01-15T10:30:00.000Z",
          "conversationId": "clx1abc23def"
        }
      ]
    }
  ]
}
```

---

### `GET /conversation/:conversationId`

**Get a single conversation with all its messages**, ordered oldest first.

**Auth required:** ✅ Yes

**URL params:**
- `conversationId` — the conversation ID (cuid string)

**Response:**
```json
{
  "conversation": {
    "id": "clx1abc23def",
    "title": "What is quantum computing?",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "userId": "uuid-from-supabase",
    "messages": [
      {
        "id": "clx1msg001",
        "content": "What is quantum computing?",
        "role": "USER",
        "sources": null,
        "createdAt": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "clx1msg002",
        "content": "Quantum computing is a type of computation...",
        "role": "ASSISTANT",
        "sources": [
          { "url": "https://example.com", "title": "Quantum Computing Explained" }
        ],
        "createdAt": "2024-01-15T10:30:05.000Z"
      }
    ]
  }
}
```

**Errors:**
```json
{ "error": "Conversation not found" }   // 404
{ "error": "Forbidden" }               // 403 — not your conversation
```

---

### `DELETE /conversation/:conversationId`

**Delete a conversation and all its messages.**

**Auth required:** ✅ Yes

**URL params:**
- `conversationId` — the conversation ID

**Response:**
```json
{
  "message": "Deleted successfully"
}
```

**Errors:**
```json
{ "error": "Conversation not found" }   // 404
{ "error": "Forbidden" }               // 403 — not your conversation
```

---

## Caching

To avoid hitting the Tavily API on every request (it costs money and has rate limits), search results are cached in the `SearchCache` table.

**How it works:**
1. When a query comes in, we check the DB for an exact match on the query string
2. If a cache entry exists and `expiresAt` is in the future → use cached results, skip Tavily
3. If no cache or it's expired → call Tavily, store the results with a new `expiresAt`
4. Default TTL is **1 hour**

**To change the TTL**, update this line in `server.ts`:
```typescript
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — change as needed
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (first time setup)
npx prisma db push

# Start dev server
npm run dev
```

---

## Quick Test with curl

```bash
# Replace TOKEN with a real Supabase JWT

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
  -d '{"conversationId": "clx1abc23def", "query": "Tell me more about qubits"}'

# Delete a conversation
curl -X DELETE http://localhost:3000/conversation/clx1abc23def \
  -H "Authorization: Bearer TOKEN"
```