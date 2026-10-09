import type { Browser, BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function players(browser: Browser) {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    for (let index = 0; index < 5; index++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
      contexts.push(context); pages.push(await context.newPage());
    }
    let code = "";
    for (const [index, page] of pages.entries()) {
      await page.goto(index ? `/?code=${code}` : "/");
      await expect(page.getByRole("status").first()).toHaveText("Connected");
      await page.getByLabel("Your nickname").fill(`Voter ${index}`);
      await page.getByRole("button", { name: index ? "Join private room" : "Create private room" }).click();
      if (!index) code = await page.getByTestId("room-code").innerText();
      await expect(page.getByTestId("room-code")).toHaveText(code);
    }
    for (const page of pages) await page.getByRole("button", { name: "Ready", exact: true }).click();
    await pages[0].getByRole("button", { name: "Start case" }).click();
    for (const page of pages) {
      await page.getByRole("button", { name: "Reveal my card" }).click();
      await page.getByRole("button", { name: "Proceed to Investigation" }).click();
    }
    for (const page of pages) await expect(page.getByRole("heading", { name: "Opening investigation" })).toBeVisible();
    return { contexts, pages };
  } catch (error) { await Promise.all(contexts.map(c => c.close())); throw error; }
}
async function ballot(page: Page) {
  await page.getByRole("combobox", { name: "Ballot cause" }).selectOption("wrong_file_forward");
  await page.getByRole("radio", { name: /^Tobi/ }).check();
  await page.getByRole("combobox", { name: "Ballot resolution" }).selectOption("secure_and_correct");
  await page.getByRole("button", { name: "Seal my ballot" }).click();
}

test("five private ballots reveal the three chapters, missions and chronological receipts with reload recovery", async ({ browser, serverClock }) => {
  const { contexts, pages } = await players(browser);
  try {
    await serverClock.advance(390_000);
    for (const page of pages) await expect(page.getByRole("heading", { name: "What really happened?" })).toBeVisible();
    await pages[0].screenshot({ path: "work/voting-mobile.png", fullPage: true });
    await ballot(pages[0]);
    await expect(pages[0].getByRole("heading", { name: "Your ballot is sealed" })).toBeVisible();
    await pages[0].reload();
    await expect(pages[0].getByRole("heading", { name: "Your ballot is sealed" })).toBeVisible();
    await expect(pages[1].getByRole("heading", { name: "Your ballot is sealed" })).toHaveCount(0);
    await expect(pages[1].getByRole("button", { name: "Seal my ballot" })).toBeDisabled();
    await expect(pages[1].getByRole("heading", { name: "The Accusations" })).toHaveCount(0);
    for (const page of pages.slice(1, 4)) { await ballot(page); await expect(page.getByRole("heading", { name: "Your ballot is sealed" })).toBeVisible(); }
    await expect(pages[0].getByRole("heading", { name: "What really happened?" })).toBeVisible();
    await ballot(pages[4]);
    for (const page of pages) {
      await expect(page.getByRole("heading", { name: "The Accusations" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Principal participant tallies" })).toContainText("5/5");
      await expect(page.getByTestId("revealed-actor")).toHaveCount(0);
    }
    await pages[0].screenshot({ path: "work/reveal-accusations-mobile.png", fullPage: true });
    await pages[0].getByRole("button", { name: "Uncover the truth" }).click();
    await expect(pages[0].getByRole("heading", { name: "The Truth", exact: true })).toBeVisible();
    await expect(pages[0].getByTestId("revealed-actor")).toHaveText("Tobi");
    await expect(pages[0].getByText("Group success", { exact: true })).toBeVisible();
    await pages[0].screenshot({ path: "work/reveal-truth-mobile.png", fullPage: true });
    await pages[0].getByRole("button", { name: "Follow the receipts" }).click();
    await expect(pages[0].getByRole("heading", { name: "The Receipts", exact: true })).toBeVisible();
    await expect(pages[0].getByRole("list", { name: "Canonical timeline" }).getByRole("listitem")).toHaveCount(6);
    await expect(pages[0].getByRole("list", { name: "Canonical timeline" })).toContainText("20:41 · Tobi");
    await expect(pages[0].getByRole("region", { name: "Mission outcomes" }).getByRole("article")).toHaveCount(5);
    expect(await pages[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pages[0].screenshot({ path: "work/reveal-receipts-mobile.png", fullPage: true });
    await pages[1].getByRole("button", { name: "Skip to receipts" }).click();
    await expect(pages[1].getByRole("heading", { name: "The Receipts", exact: true })).toBeVisible();
    await pages[0].reload();
    await expect(pages[0].getByRole("heading", { name: "The Accusations" })).toBeVisible();
    await pages[0].getByRole("button", { name: "2. Truth", exact: true }).click();
    await expect(pages[0].getByTestId("revealed-actor")).toHaveText("Tobi");
    await serverClock.advance(60_000);
    await expect(pages[0].getByRole("heading", { name: "The Truth", exact: true })).toBeVisible();
    await expect(pages[0].getByRole("button", { name: /Afterparty|Gist Lounge/ })).toHaveCount(0);
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test("the voting UI stays sealed before 45 seconds and reveals missing ballots as abstentions", async ({ browser, serverClock }) => {
  const { contexts, pages } = await players(browser);
  try {
    await serverClock.advance(390_000);
    await expect(pages[0].getByRole("heading", { name: "What really happened?" })).toBeVisible();
    await ballot(pages[0]); await expect(pages[0].getByRole("heading", { name: "Your ballot is sealed" })).toBeVisible();
    await serverClock.advance(44_999);
    await expect(pages[1].getByRole("heading", { name: "What really happened?" })).toBeVisible();
    await expect(pages[1].getByRole("heading", { name: "The Accusations" })).toHaveCount(0);
    await serverClock.advance(1);
    for (const page of pages) await expect(page.getByRole("heading", { name: "The Accusations" })).toBeVisible();
    await expect(pages[0].getByRole("region", { name: "Cause tallies" })).toContainText("4 abstentions");
    await expect(pages[0].getByRole("region", { name: "Principal participant tallies" })).toContainText("Unresolved");
    await pages[0].getByRole("button", { name: "Uncover the truth" }).click();
    await expect(pages[0].getByText("Group objective missed", { exact: true })).toBeVisible();
    await expect(pages[0].getByText("Not identified", { exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
