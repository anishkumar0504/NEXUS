<p align="center">
  <img src="https://img.shields.io/badge/NEXUS-Real--time%20AI%20Platform-6366f1?style=for-the-badge&logo=rocket&logoColor=white" />
</p>
<h1 align="center">NEXUS</h1>
<p align="center">
  <b>AI Search Engine × Real-Time Multi-Agent Group Chats</b><br/>
  Perplexity-inspired search meets collaborative AI team conversations. Search the web with intelligent agents, then invite them into persistent group chats with distinct roles.
</p>
<p align="center">
  <a href="https://ai-search-engine-amber-one.vercel.app/">🚀 Live Demo</a> •
  <a href="#-key-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-core-functionality">Agents</a> •
  <a href="#-getting-started">Getting Started</a>
</p>
---
 
## ✨ What's NEXUS?
 
NEXUS is a full-stack AI collaboration platform that combines two powerful experiences:
 
1. **🔍 AI Search Engine** — Perplexity-style real-time web search with streamed AI answers, source citations, and conversation memory.
2. **💬 Multi-Agent Group Chats** — Persistent group rooms where humans and multiple specialized AI agents collaborate in real time. Mention agents with `@` to assign tasks.
---
 
## 🚀 Key Features
 
### 🔎 Intelligent AI Search
- **Real-time web search** powered by Tavily API
- **Streaming AI responses** using Gemini 2.5 Flash
- **Source citations** with clickable references
- **Smart caching** to reduce API usage and improve speed
- **Conversation history** with context-aware follow-ups
### 👥 Real-Time Group Chats
- **Socket.IO-powered** live messaging with presence indicators
- **Persistent group rooms** — create, join, and manage multiple chat spaces
- **Member avatars & live status** showing who's online
- **Message history** synced across all clients instantly
### 🤖 Multi-Agent Collaboration
Invoke specialized AI agents inside any group chat using `@mentions`:
 
| Agent | Trigger | Role |
|-------|---------|------|
| **Nexus** | `@nexus` | General AI assistant — answers questions, searches history, summarizes context |
| **Summarizer** | `@summarizer` | Condenses long conversations into key takeaways and action items |
| **ImageGen** | `@imagegen` | Generates images from text descriptions directly in chat |
| **Deep Research** | `@research` | Executes multi-step research workflows with web search, analysis, and mind-map generation |
 
- **Agent typing indicators** — see when an AI is "thinking"
- **Research workflow panel** — visualize step-by-step research progress (plan → search → analyze → synthesize → mind map)
- **Plan cards** — structured research outputs with sources and reasoning chains
### 🔐 Authentication & Data
- **Google & GitHub OAuth** via Supabase Auth
- **PostgreSQL** database with Prisma ORM
- **Redis + BullMQ** for background job processing and rate limiting
- **Responsive UI** built with React 19, Tailwind CSS v4, and Framer Motion
---
 
## 🏗 Architecture
 
```
┌─────────────────────────────────────────┐
│           Frontend (React + Vite)       │
│  ┌─────────────┐    ┌────────────────┐ │
│  │ Search Mode │    │ Group Chat Mode│ │
│  └──────┬──────┘    └───────┬────────┘ │
└─────────┼───────────────────┼──────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────┐
│      Express Backend (TypeScript)       │
│  ┌─────────────┐    ┌────────────────┐ │
│  │ REST API    │    │ Socket.IO      │ │
│  │ /search     │    │ /chat rooms    │ │
│  │ /history    │    │ /agents        │ │
│  └──────┬──────┘    └───────┬────────┘ │
└─────────┼───────────────────┼──────────┘
          │                   │
    ┌─────┴─────┐      ┌────┴────┐
    ▼           ▼      ▼         ▼
┌───────┐  ┌────────┐ ┌─────┐  ┌────────┐
│Tavily │  │Gemini  │ │Redis│  │BullMQ  │
│Search │  │2.5Flash│ │Cache│  │Workers │
└───────┘  └────────┘ └─────┘  └────────┘
                │
         ┌──────┴──────┐
         ▼             ▼
    ┌─────────┐   ┌──────────┐
    │Supabase │   │PostgreSQL│
    │  Auth   │   │  Prisma  │
    └─────────┘   └──────────┘
```
 
### Communication Flow
1. **Search Mode** → HTTP REST API → Streaming SSE responses
2. **Group Chat Mode** → WebSocket (Socket.IO) → Real-time bidirectional events
3. **Agent Jobs** → BullMQ + Redis → Background processing for heavy tasks (research, image gen)
---
 
## 🛠 Tech Stack
 
### Frontend
- **React 19** + TypeScript + Vite
- **Tailwind CSS v4** with Vite plugin
- **Socket.IO Client** for real-time communication
- **Framer Motion** for animations
- **React Markdown** for rich message rendering
- **Supabase Auth** for session management
### Backend
- **Node.js** + **Express.js** + TypeScript
- **Socket.IO** for WebSocket event handling
- **BullMQ** + **Redis** for background job queues and rate limiting
- **Prisma ORM** + **PostgreSQL** for data persistence
- **Gemini 2.5 Flash** for AI generation
- **Tavily API** for web search
- **Supabase** for authentication
### Deployment
- **Vercel** — Frontend
- **Render** — Backend API + Socket.IO server
- **Supabase** — Database & Auth
- **Redis Cloud / Upstash** — BullMQ broker & caching
---
 
## 📸 Core Functionality
 
### AI Search Mode
Users can search any topic and receive:
- AI-generated answers with real-time web data
- Inline source citations
- Streaming token-by-token output
- Persistent thread history with follow-up support
### Group Chat Mode
- Create or join group chat rooms
- See live member presence and avatars
- Send messages that persist in PostgreSQL
- **@mention agents** to invoke specialized AI workers:
  - `@summarizer` — "Summarize what we discussed about Kubernetes"
  - `@imagegen` — "Generate a diagram of our microservices architecture"
  - `@research` — "Research the latest Node.js performance benchmarks"
  - `@nexus` — General Q&A and context recall
### Research Agent Workflow
When `@research` is invoked, the agent executes a 5-step pipeline:
1. **Plan** — Breaks the query into sub-questions
2. **Search** — Queries Tavily for live sources
3. **Analyze** — Reads and evaluates source quality
4. **Synthesize** — Combines findings into structured insights
5. **Mind Map** — Generates a visual knowledge graph
All steps stream progress to the Research Agent Panel in real time.
 
---
 
## 📂 Repository Structure
 
```
NEXUS/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/              # Group chat UI components
│   │   │   │   ├── AgentConfig.ts     # Agent role definitions
│   │   │   │   ├── ChatHeader.tsx
│   │   │   │   ├── ChatInput.tsx      # @mention support
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MentionDropdown.tsx
│   │   │   │   ├── ResearchAgentPanel.tsx
│   │   │   │   └── PlanCard.tsx
│   │   │   ├── ResearchAgentPanel.tsx
│   │   │   ├── ResultView.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── hooks/
│   │   │   ├── useGroupChat.ts    # Socket.IO chat logic
│   │   │   ├── useGroupChats.ts   # Chat room management
│   │   │   ├── useResearchSocket.ts
│   │   │   └── useSearch.tsx
│   │   ├── pages/
│   │   │   ├── Chatpage.tsx       # Group chat page
│   │   │   ├── Dashboard.tsx
│   │   │   └── Auth.tsx
│   │   └── types/                 # Shared TS types
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── routes/                # REST API routes
│   │   ├── socket/                # Socket.IO handlers
│   │   ├── workers/               # BullMQ background workers
│   │   ├── services/              # AI & search services
│   │   └── prisma/                # Database schema & client
│   ├── package.json
│   └── README.md
│
└── README.md
```
 
---
 
## 🚦 Getting Started
 
Detailed setup instructions are available in:
 
- [`frontend/README.md`](./frontend/README.md) — Vite + React setup, environment variables, Tailwind config
- [`backend/README.md`](./backend/README.md) — Express + Socket.IO + BullMQ setup, Prisma migrations, Redis connection
### Quick Start
 
```bash
# 1. Clone
git clone https://github.com/anishkumar0504/NEXUS.git
cd NEXUS
 
# 2. Backend
cd backend
npm install
npx prisma migrate dev
npm run dev
 
# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```
 
### Required Environment Variables
 
**Backend**
```env
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
SUPABASE_URL="..."
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
GEMINI_API_KEY="..."
TAVILY_API_KEY="..."
```
 
**Frontend**
```env
VITE_BACKEND_URL="http://localhost:3000"
VITE_SUPABASE_URL="..."
VITE_SUPABASE_ANON_KEY="..."
```
 
---
 
## 🎯 Roadmap
 
- [x] Real-time multi-agent group chats
- [x] @mention agent invocation system
- [x] Deep research workflow with visual progress
- [x] Socket.IO + BullMQ background processing
- [ ] **Agent memory** — cross-conversation context recall
- [ ] **File uploads** — RAG-based document chat in groups
- [ ] **Voice messages** — STT/TTS integration
- [ ] **Mobile app** — React Native companion
- [ ] **Custom agents** — user-defined agent roles & prompts
- [ ] **Agent marketplace** — share specialized agent configurations
---
 
## 👨‍💻 Author
 
**Anish Kumar**
 
- GitHub: [@anishkumar0504](https://github.com/anishkumar0504)
- Projects: LinkHub, Exchange Backend, YouTube System Backend, Web3 dApps
---
 
## ⭐ Support
 
If you found this project useful, consider giving the repository a star — it helps others discover it!
 
<p align="center">
  <i>Built with curiosity, caffeine, and a lot of Socket.IO events.</i>
</p>
