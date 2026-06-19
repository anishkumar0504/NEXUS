import { createServer } from "http"; // 1. Import createServer
import { app } from "./server/server.js";
import { initSocketBridge } from "./server/socketBridge.js"; // 2. Import your bridge
import "./messageWorker.js";
import "./agentWorker.js";

console.log("[workers] message + agent workers started");

const PORT = process.env.PORT || 3000;

// 3. Create an HTTP server wrapping the Express app
const httpServer = createServer(app);

// 4. Initialize Socket.IO ON THE SAME SERVER INSTANCE
// This attaches WS listeners to the same port as your REST API
initSocketBridge(httpServer);

// 5. Listen using the httpServer, NOT app.listen()
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});