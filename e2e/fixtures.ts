import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test as base } from "@playwright/test";

export const test = base.extend<Record<string, never>, { serverClock: { advance: (ms: number) => Promise<void> } }>({
  // eslint-disable-next-line no-empty-pattern -- This worker fixture has no dependencies.
  serverClock: [async ({}, use) => {
    const child = fork(resolve("e2e/server-fixture.mjs"), { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    type Message = { type: string; requestId?: string };
    function wait(type: string, requestId?: string) {
      return new Promise<void>((resolveReady, reject) => {
        const timer = setTimeout(() => { finish(); reject(new Error(`Backend fixture did not report ${type}.`)); }, 5_000);
        const onExit = () => { finish(); reject(new Error("Backend fixture exited unexpectedly.")); };
        const onMessage = (message: Message) => { if (message.type === type && message.requestId === requestId) { finish(); resolveReady(); } };
        function finish() { clearTimeout(timer); child.off("message", onMessage); child.off("exit", onExit); }
        child.on("message", onMessage); child.once("exit", onExit);
      });
    }
    try {
      await wait("ready");
      await use({ advance: async ms => { const requestId = randomUUID(); const done = wait("advanced", requestId); child.send({ type: "advance", requestId, ms }); await done; } });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise<void>(resolveExit => child.once("exit", () => resolveExit()));
        child.kill("SIGTERM"); await exited;
      }
    }
  }, { scope: "worker", auto: true }],
});
export { expect } from "@playwright/test";
