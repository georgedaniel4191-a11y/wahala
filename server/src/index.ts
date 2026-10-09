import { createApplication } from "./app";

const production = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;
if (production && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("Set SESSION_SECRET to a random secret of at least 32 characters in production.");
}
const application = createApplication({
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  sessionSecret,
  secureCookies: process.env.COOKIE_SECURE === "true" || (production && process.env.COOKIE_SECURE !== "false"),
});
application.httpServer.listen(4000, () => {
  console.log("Wahala server listening on port 4000. Socket.IO is ready.");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void application.close(); });
}
