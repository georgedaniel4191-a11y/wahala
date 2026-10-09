/* global process */
// Test-only IPC clock for the built backend. No HTTP/socket clock controls exist.
import { createApplication } from "../server/dist/app.js";
if (!process.send) throw new Error("Run this fixture through the Playwright worker.");
let clock = Date.now();
const application = createApplication({ now: () => clock });
application.httpServer.listen(4000, "127.0.0.1", () => process.send({ type: "ready" }));
process.on("message", message => {
  if (message.type !== "advance" || !Number.isFinite(message.ms) || message.ms < 0 || message.ms > 3_600_000) return;
  clock += message.ms;
  application.cleanup();
  process.send({ type: "advanced", requestId: message.requestId });
});
async function close() { await application.close(); process.exit(0); }
process.on("SIGTERM", close);
process.on("disconnect", close);
