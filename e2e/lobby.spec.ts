import { test, expect, type BrowserContext, type Page } from "@playwright/test";

async function enter(page: Page, name: string, code?: string) {
  await page.goto(code ? `/?code=${code}` : "/");
  await expect(page.getByRole("status").first()).toHaveText("Connected");
  await page.getByLabel("Your nickname").fill(name);
  await page.getByRole("button", { name: code ? "Join private room" : "Create private room" }).click();
}

test("five browser sessions share readiness, deny a sixth seat, and preserve a seat on reload", async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  let websocketUpgraded = false;
  try {
    for (let index = 0; index < 6; index += 1) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      contexts.push(context); pages.push(await context.newPage());
    }
    pages[0].on("websocket", (socket) => {
      socket.on("framesent", ({ payload }) => { if (payload === "5") websocketUpgraded = true; });
    });
    await enter(pages[0], "Ada");
    const code = await pages[0].getByTestId("room-code").innerText();
    for (let index = 1; index < 5; index += 1) {
      await enter(pages[index], `Guest ${index}`, code);
      await expect(pages[index].getByTestId("room-code")).toHaveText(code);
    }
    await enter(pages[5], "Sixth player", code);
    await expect(pages[5].getByRole("alert").filter({ hasText: "All five seats are occupied." })).toBeVisible();
    for (let index = 0; index < 5; index += 1) {
      await pages[index].getByRole("button", { name: "Ready", exact: true }).click();
    }
    for (const page of pages.slice(0, 5)) {
      await expect(page.getByTestId("ready-state").filter({ hasText: "Ready ✓" })).toHaveCount(5);
      await expect(page.getByText("Everyone is ready. The host can start the case.")).toBeVisible();
    }
    await pages[1].getByRole("button", { name: "Not ready", exact: true }).click();
    await expect(pages[0].getByRole("button", { name: "Start case" })).toBeDisabled();
    await expect(pages[0].getByTestId("ready-state").filter({ hasText: "Ready ✓" })).toHaveCount(4);
    await pages[1].reload();
    await expect(pages[1].getByTestId("room-code")).toHaveText(code);
    await expect(pages[1].getByText("Guest 1 (you)", { exact: true })).toBeVisible();
    await expect(pages[1].getByRole("list", { name: "Lobby seats" }).getByRole("listitem")).toHaveCount(5);
    await expect(pages[0].getByText("Guest 1", { exact: true })).toBeVisible();
    const cookies = await contexts[0].cookies();
    expect(cookies.find((cookie) => cookie.name === "wahala_guest")?.httpOnly).toBe(true);
    expect(await pages[0].evaluate(() => document.cookie)).not.toContain("wahala_guest");
    await expect.poll(() => websocketUpgraded).toBe(true);
    expect(await pages[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pages[0].screenshot({ path: "work/lobby-mobile.png", fullPage: true });

    await pages[1].getByRole("button", { name: "Ready", exact: true }).click();
    await expect(pages[0].getByRole("button", { name: "Start case" })).toBeEnabled();
    await expect(pages[2].getByRole("button", { name: "Start case" })).toHaveCount(0);
    await pages[0].getByRole("button", { name: "Start case" }).click();
    const names: string[] = [];
    const memories: string[] = [];
    for (const page of pages.slice(0, 5)) {
      await expect(page.getByRole("heading", { name: "Your secret dossier" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Lobby seats" })).toHaveCount(0);
      await expect(page.getByTestId("starting-memory")).toHaveCount(0);
      await page.getByRole("button", { name: "Reveal my card" }).click();
      names.push(await page.getByTestId("persona-name").innerText());
      memories.push(await page.getByTestId("starting-memory").innerText());
      await expect(page.getByTestId("mission")).not.toBeEmpty();
      await expect(page.getByTestId("ability")).not.toBeEmpty();
    }
    expect([...names].sort()).toEqual(["Tobi", "Ada", "Zainab", "Emeka", "Feyi"].sort());
    for (let index = 0; index < 5; index += 1) {
      const text = await pages[index].locator("body").innerText();
      for (let other = 0; other < 5; other += 1) if (other !== index) expect(text).not.toContain(memories[other]);
    }
    await pages[0].screenshot({ path: "work/secret-role-mobile.png", fullPage: true });
    await pages[1].getByRole("button", { name: "Hide my card" }).click();
    await expect(pages[1].getByTestId("starting-memory")).toHaveCount(0);
    await pages[1].reload();
    await expect(pages[1].getByRole("heading", { name: "Your secret dossier" })).toBeVisible();
    await pages[1].getByRole("button", { name: "Reveal my card" }).click();
    await expect(pages[1].getByTestId("persona-name")).toHaveText(names[1]);
    await expect(pages[1].getByTestId("starting-memory")).toHaveText(memories[1]);
    for (const page of pages.slice(0, 5)) {
      await page.getByRole("button", { name: "Proceed to Investigation" }).click();
      await expect(page.getByRole("button", { name: "Role acknowledged", exact: true })).toBeDisabled();
      await expect(page.getByText("Your role is confirmed. Investigation will be available in the next build.")).toBeVisible();
    }
  } finally { await Promise.all(contexts.map((context) => context.close())); }
});

test("AI preference requires explicit consent before ready and exposes a humans-only option", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toHaveText("Connected");
  await page.getByLabel("Your nickname").fill("Zainab");
  await expect(page.getByLabel("Room preference")).toHaveValue("none");
  await page.getByLabel("Room preference").selectOption("allow_bots");
  await page.getByRole("button", { name: "Create private room" }).click();
  await expect(page.getByText(/AI-controlled characters may fill empty seats/)).toBeVisible();
  const ready = page.getByRole("button", { name: "Ready", exact: true });
  await expect(ready).toBeDisabled();
  await page.getByRole("checkbox", { name: "I accept possible AI participation and hidden character identities." }).check();
  await expect(ready).toBeEnabled();
  await ready.click();
  await expect(page.getByTestId("ready-state")).toHaveText("Ready ✓");
  await page.getByRole("button", { name: "Not ready", exact: true }).click();
  await expect(ready).toBeDisabled();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
});
