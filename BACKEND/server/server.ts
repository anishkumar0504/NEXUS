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
export { app };