  import { createServer } from "http";
  import { app } from "./server/server.js";
  import { initSocketBridge } from "./server/Socketbridge.js";
  import { messageWorker } from "./messageWorker.js";      // named export
  import { agentWorker } from "./agentWorker.js";         // named export

  // Reference them to prevent tree-shaking and satisfy TypeScript
  console.log("[workers] workers initialized:", !!messageWorker, !!agentWorker);

  const PORT = process.env.PORT || 3000;

  const httpServer = createServer(app);
  initSocketBridge(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });