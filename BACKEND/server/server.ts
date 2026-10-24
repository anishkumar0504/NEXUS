import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import askRouter from "../routes/ask.js";
import conversationsRouter from "../routes/conversations.js";
import { startKeepAlive } from "../lib/keepAlive.js";
import groupRouter from "../routes/group.js";
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// ── Keep-alive cron ──
startKeepAlive();

// ── Health check ──
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Routes ──
app.use("/ask", askRouter);
app.use("/conversation", conversationsRouter);
app.get("/conversations", conversationsRouter); // list all
app.use("/groups", groupRouter);
// 404 for unknown routes (after all app.use routes)
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Error handler (4 args required)
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  if (res.headersSent) return next(err); // already streaming, let Express close it
  res.status(500).json({ error: "Internal server error" });
});
export { app };
