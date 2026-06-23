# 🔍 AI Search Engine + Multi agent &Multiuser

A Perplexity-inspired AI search engine built from scratch using modern full-stack technologies.

Search the web in real time, get AI-generated answers with streaming responses, maintain conversation history, and continue discussions with intelligent follow-up questions.

## ✨ Features

* 🔎 Real-time web search powered by Tavily
* 🤖 AI-generated answers using Gemini 2.5 Flash
* ⚡ Streaming responses for instant output
* 💾 Smart caching to reduce API usage and improve performance
* 💬 Persistent conversation history
* 🔄 Context-aware follow-up questions
* 🔐 Google & GitHub Authentication via Supabase
* 🗄 PostgreSQL database with Prisma ORM
* 🧪 Unit-tested backend
* 📱 Responsive modern UI
* 🚀 Production deployment on Vercel + Render

---

## 🏗 Architecture

```text
┌───────────────┐
│   Frontend    │
│ React + Vite  │
└───────┬───────┘
        │
        ▼
┌───────────────────┐
│ Express Backend   │
│ TypeScript        │
└───────┬───────────┘
        │
        ├── Tavily Search API
        │
        ├── Gemini 2.5 Flash
        │
        ├── Supabase Auth
        │
        └── PostgreSQL + Prisma
```

---

## 🛠 Tech Stack

### Frontend

* React
* TypeScript
* Vite
* React Router
* Axios
* Supabase Auth

### Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* PostgreSQL
* Gemini 2.5 Flash
* Tavily Search API
* Supabase
* Vitest

### Deployment

* Vercel (Frontend)
* Render (Backend)
* Supabase (Database & Auth)

---

## 📸 Core Functionality

### Search

Users can search any topic and receive:

* AI-generated responses
* Real-time web information
* Source citations
* Streamed output

### Conversation History

Every search is stored as a conversation.

Users can:

* View previous searches
* Continue conversations
* Delete conversations

### Follow-Up Support

The AI remembers previous messages and generates contextual responses based on conversation history.

### Authentication

Users can sign in using:

* Google OAuth
* GitHub OAuth

Powered by Supabase Authentication.

---

## 🚀 Live Demo

Frontend:
https://ai-search-engine-amber-one.vercel.app/

GitHub:
https://github.com/anishkumar0504/AI_SEARCH_ENGINE

---

## 📂 Repository Structure

```text
AI_SEARCH_ENGINE/

├── frontend/
│   ├── README.md
│   └── ...
│
├── backend/
│   ├── README.md
│   └── ...
│
└── README.md
```

---

## 📖 Documentation

Detailed setup instructions are available inside:

* frontend/README.md
* backend/README.md

These documents include:

* Installation
* Environment Variables
* Project Structure
* API Documentation
* Authentication Flow
* Testing Instructions
* Deployment Details

---

## 🎯 Future Improvements

* Multi-model support
* Search result ranking improvements
* AI conversation sharing
* User workspaces
* Semantic search memory
* RAG-based document uploads
* Mobile application

---

## 👨‍💻 Author

Anish Kumar

GitHub:
https://github.com/anishkumar0504

---

## ⭐ Support

If you found this project useful, consider giving the repository a star.
