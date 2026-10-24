# NEXUS

**AI Search Engine × Real-Time Multi-Agent Group Collaboration**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-nexus.iamanish.in-black?style=for-the-badge&logo=vercel)](https://nexus.iamanish.in/)
[![Tech](https://img.shields.io/badge/Stack-React%2019%20%7C%20Node.js%20%7C%20TypeScript%20%7C%20Socket.IO%20%7C%20Prisma%20%7C%20Redis-blue?style=for-the-badge)](#-tech-stack)

> Perplexity-style real-time web search meets collaborative multi-agent group chats.  
> Search the web with streaming AI answers + citations, then invite specialized agents into persistent group rooms via `@mentions`.

**Live:** [https://nexus.iamanish.in/](https://nexus.iamanish.in/)

---

## 🎯 Project Overview (Resume Summary)

**NEXUS** is a full-stack AI collaboration platform that unifies two production-grade experiences:

1. **Intelligent AI Search Engine** — Real-time web search (Tavily), streaming answers (Gemini 2.5 Flash / multi-provider fallback), source citations, conversation memory, and smart caching.
2. **Real-Time Multi-Agent Group Chats** — Socket.IO-powered rooms where humans and specialized AI agents collaborate. Users `@mention` agents (`@nexus`, `@summarizer`, `@imagegen`, `@research`) to delegate tasks. Heavy workloads (research, image generation) are offloaded to BullMQ workers.

**Key engineering highlights for recruiters:**
- End-to-end TypeScript (React 19 + Express)
- Real-time bidirectional communication (Socket.IO)
- Background job processing & rate limiting (BullMQ + Redis)
- Multi-LLM orchestration with intelligent fallbacks (OpenRouter → Groq → Gemini)
- Multi-step research agent with live progress streaming and mind-map generation
- Auth (Supabase OAuth — Google/GitHub), PostgreSQL (Prisma), search result caching
- Production deployment: Frontend on Vercel / custom domain, Backend on Render, DB/Auth on Supabase, Redis on Upstash/Redis Cloud

---

## ✨ Core Features

### 🔎 AI Search Mode
- Real-time web search via **Tavily API** (advanced depth)
- Streaming token-by-token answers (SSE)
- Inline source citations with clickable links
- Conversation history + context-aware follow-ups
- Search result caching (PostgreSQL, 1-hour TTL) to reduce API cost & latency
- Clean, Perplexity-inspired UI with Framer Motion animations

### 💬 Real-Time Group Chats
- Create / join / manage persistent group rooms
- Live messaging, presence indicators, member avatars
- Message history persisted in PostgreSQL and synced instantly via Socket.IO
- Typing indicators for both humans and agents

### 🤖 Multi-Agent System (`@mentions`)

| Agent          | Trigger        | Capabilities |
|----------------|----------------|--------------|
| **Nexus**      | `@nexus`       | General assistant. Uses chat history when relevant. For complex tasks, asks clarifying questions with options (Claude-style plan → confirm flow) before answering. |
| **Summarizer** | `@summarizer`  | Condenses recent conversation into key takeaways, decisions, and action items. |
| **ImageGen**   | `@imagegen`    | Generates images from text prompts (Pollinations / Hugging Face) and posts them directly in chat. |
| **Deep Research** | `@research` | Multi-step research pipeline: Search → Extract facts → Analyze → Synthesize → Optional mind-map image + follow-up questions. Streams step-by-step progress to a dedicated Research Panel. |

**Research Agent Pipeline (detailed):**
1. **Search** — Tavily (advanced) with DuckDuckGo free fallback
2. **Extract** — Key facts via OpenRouter free models (with Groq fallback)
3. **Synthesize** — Structured answer with citations
4. **Mind Map** (optional) — Generates visualization via free image endpoint
5. **Follow-ups** — Suggests next questions

All heavy agent work is processed asynchronously via **BullMQ workers**.

### 🔐 Auth & Data Layer
- Google + GitHub OAuth via Supabase Auth
- JWT verification on every protected route
- PostgreSQL schema (Users, Conversations, Messages, GroupChats, GroupMembers, Agents, Tasks, SearchCache)
- Redis for job queues + rate limiting
- AWS S3 / Supabase Storage for generated assets

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)               │
│  ┌──────────────────┐          ┌──────────────────────────┐ │
│  │   Search Mode    │          │    Group Chat Mode       │ │
│  │  (SSE streaming) │          │  (Socket.IO real-time)   │ │
│  └────────┬─────────┘          └────────────┬─────────────┘ │
└───────────┼─────────────────────────────────┼───────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Express + TypeScript Backend                   │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ REST Routes  │   │  Socket.IO   │   │  BullMQ Workers │  │
│  │ /ask         │   │  rooms       │   │  agentWorker    │  │
│  │ /conversations│  │  presence    │   │  messageWorker  │  │
│  │ /groups      │   │  agent events│   │  research jobs  │  │
│  └──────┬───────┘   └──────┬───────┘   └────────┬────────┘  │
└─────────┼──────────────────┼────────────────────┼───────────┘
          │                  │                    │
    ┌─────┴─────┐      ┌─────┴─────┐        ┌─────┴─────┐
    ▼           ▼      ▼           ▼        ▼           ▼
┌───────┐  ┌────────┐ ┌─────┐  ┌────────┐ ┌─────┐  ┌────────┐
│Tavily │  │Gemini /│ │Redis│  │BullMQ  │ │S3 / │  │PostgreSQL│
│Search │  │OpenRouter│ │Cache│  │Queues  │ │Storage│ │(Prisma) │
│       │  │Groq    │ └─────┘  └────────┘ └─────┘  └────────┘
└───────┘  └────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
     ┌─────────┐   ┌──────────┐
     │Supabase │   │  Auth    │
     │  Auth   │   │  JWT     │
     └─────────┘   └──────────┘
```

**Communication patterns:**
- Search → HTTP REST + Server-Sent Events (streaming)
- Group Chat → WebSocket (Socket.IO) for bidirectional events
- Agents → BullMQ jobs (research, image gen, summarization) so the main event loop stays responsive

---

## 🛠 Tech Stack

### Frontend
| Technology          | Purpose                          |
|---------------------|----------------------------------|
| React 19 + TypeScript | UI & type safety                |
| Vite                | Build tool & HMR                 |
| Tailwind CSS v4     | Styling                          |
| Socket.IO Client    | Real-time chat                   |
| Framer Motion       | Animations                       |
| React Markdown      | Rich message rendering           |
| Supabase JS         | Auth session management          |
| React Router        | Client-side routing              |

### Backend
| Technology          | Purpose                          |
|---------------------|----------------------------------|
| Node.js + Express 5 | API server                       |
| TypeScript          | Type safety                      |
| Socket.IO           | Real-time events                 |
| BullMQ + Redis      | Background jobs & rate limiting  |
| Prisma + PostgreSQL | ORM & persistence                |
| Supabase            | Auth + optional storage          |
| Tavily              | Web search                       |
| Google Gemini / OpenRouter / Groq | Multi-provider LLM orchestration |
| Zod                 | Runtime validation               |
| Vitest              | Testing                          |

### Infrastructure
- **Frontend**: Vercel (custom domain: [nexus.iamanish.in](https://nexus.iamanish.in/))
- **Backend**: Render
- **Database & Auth**: Supabase
- **Redis**: Redis Cloud / Upstash (or local Docker)
- **Object Storage**: AWS S3 (or Supabase Storage)

---

## 📂 Repository Structure

```
NEXUS/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/                 # Group chat UI
│   │   │   │   ├── ChatHeader.tsx
│   │   │   │   ├── ChatInput.tsx      # @mention autocomplete
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MentionDropdown.tsx
│   │   │   │   ├── ResearchAgentPanel.tsx
│   │   │   │   └── PlanCard.tsx
│   │   │   ├── Auth.tsx
│   │   │   ├── HomePage.tsx
│   │   │   ├── ResultView.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ResearchAgentPanel.tsx
│   │   ├── hooks/
│   │   │   ├── useGroupChat.ts       # Socket.IO chat logic
│   │   │   ├── useGroupChats.ts
│   │   │   ├── useResearchSocket.ts
│   │   │   └── useSearch.tsx
│   │   ├── pages/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
│
├── BACKEND/
│   ├── controllers/
│   │   └── groupController.ts
│   ├── lib/
│   │   ├── agentDispatcher.ts       # @mention routing + clarifying questions
│   │   ├── researchPipeline.ts      # Multi-step research agent
│   │   ├── geminiClient.ts
│   │   ├── groqClient.ts
│   │   ├── openRouterClient.ts
│   │   ├── imageClient.ts
│   │   ├── s3Client.ts
│   │   └── prisma.ts
│   ├── middleware/
│   │   └── middleware.ts            # Supabase JWT verification
│   ├── prisma/
│   │   ├── schema.prisma            # Full data model
│   │   └── migrations/
│   ├── queues/
│   │   └── queues.ts                # BullMQ setup
│   ├── routes/
│   │   ├── ask.ts                   # Search + follow-up (streaming)
│   │   ├── conversations.ts
│   │   └── group.ts
│   ├── server/
│   ├── agentWorker.ts               # Background agent jobs
│   ├── messageWorker.ts
│   ├── messagePipeline.ts
│   ├── index.ts
│   └── package.json
│
└── README.md
```

---

## 🗄 Database Schema (Prisma)

**Core models:**
- `User` — Supabase UUID, name, email, provider (GitHub/Google)
- `Conversation` + `Message` — Search history with optional sources JSON
- `SearchCache` — Query → Tavily results with TTL
- `GroupChat` + `GroupMember` + `GroupMessage`
- `Agent` (SUMMARIZER | IMAGE_GEN | ASSISTANT | RESEARCH)
- `Task` — Tracks agent job status (PENDING → RUNNING → COMPLETED/FAILED)

Messages support both human (`USER`) and agent (`AGENT`) senders, with optional `triggeringUserId` for attribution.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL (or Supabase project)
- Redis (local Docker or cloud)
- API keys: Gemini / OpenRouter / Groq, Tavily, Supabase

### 1. Clone
```bash
git clone https://github.com/anishkumar0504/NEXUS.git
cd NEXUS
```

### 2. Backend
```bash
cd BACKEND
cp .env.example .env
# Fill in DATABASE_URL, DIRECT_URL, SUPABASE_*, GEMINI_API_KEY,
# TAVILY_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, REDIS_URL, etc.

npm install
npx prisma generate
npx prisma migrate dev
npm run dev          # http://localhost:8000
```

Optional: start Redis locally
```bash
docker compose up -d   # if docker-compose.yml is present
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env
# VITE_BACKEND_URL=http://localhost:8000
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_ANON_KEY=...

npm install
npm run dev          # http://localhost:5173
```

### Environment Variables (Backend)
See `BACKEND/.env.example` for the full list. Critical ones:
- `DATABASE_URL` / `DIRECT_URL`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` / `OPENROUTER_API_KEY` / `GROQ_API_KEY`
- `TAVILY_API_KEY`
- `REDIS_URL`
- `FRONTEND_URL` (for CORS)

---

## 🧪 Testing
```bash
cd BACKEND
npm test              # Vitest
npm run test:watch
npm run coverage
```

---

## 📈 Roadmap / Future Improvements
- [x] Real-time multi-agent group chats
- [x] `@mention` agent invocation
- [x] Deep research workflow with visual progress panel
- [x] BullMQ background processing
- [ ] Cross-conversation agent memory
- [ ] File uploads + RAG in group chats
- [ ] Voice messages (STT/TTS)
- [ ] Custom user-defined agents
- [ ] Agent marketplace / sharing
- [ ] React Native companion app

---

## 👨‍💻 Author

**Anish Kumar**  
GitHub: [@anishkumar0504](https://github.com/anishkumar0504)  
Live Demo: [https://nexus.iamanish.in/](https://nexus.iamanish.in/)

This project demonstrates end-to-end ownership of a modern AI product: real-time systems, multi-agent orchestration, streaming UX, background job reliability, auth, caching, and production deployment.

---

## ⭐ Support

If this project helped you or inspired your own work, a star on the repository is greatly appreciated!

*Built with curiosity, TypeScript, Socket.IO events, and a lot of multi-provider LLM fallbacks.*
