import {app} from "./server/server.js";


import "./messageWorker.js";
import "./agentWorker.js";
 
console.log("[workers] message + agent workers started");


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});