import { test, expect } from "./fixtures";

test("mobile lounge admits adults, shares human chat and isolates a private room", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  try {
    for (let i = 0; i < pages.length; i++) {
      await pages[i].goto("/");
      await pages[i].getByLabel("Your nickname").fill(`Friend ${i}`);
      await pages[i].getByLabel("I am 18 or older", { exact: false }).check();
      await pages[i].getByRole("button", { name: "Join Gist Lounge", exact: true }).click();
      await expect(pages[i].getByRole("button", { name: "Leave lounge", exact: true })).toBeVisible();
    }
    await pages[0].getByLabel("Lounge message", { exact: true }).fill("Who is ready to play?");
    await pages[0].getByRole("button", { name: "Send to lounge", exact: true }).click();
    await expect(pages[1].getByRole("list", { name: "Lounge messages" })).toContainText("Who is ready to play?");
    expect(await pages[0].evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await pages[0].screenshot({ path: "work/lounge-mobile.png", fullPage: true });
    await pages[1].getByRole("button", { name: "Report", exact: true }).click();
    await expect(pages[1].getByRole("status").filter({ hasText: "Report sent" })).toBeVisible();
    await pages[1].getByRole("button", { name: "Block", exact: true }).click();
    await expect(pages[1].getByRole("list", { name: "Lounge messages" })).toBeEmpty();
    await pages[0].getByRole("button", { name: "Create private room", exact: true }).click();
    await expect(pages[0].getByRole("heading", { name: "Who Leaked the Screenshot?", exact: true })).toBeVisible();
    await expect(pages[0].getByRole("region", { name: "Gist Lounge" })).toHaveCount(0);
    await expect(pages[1].getByText(/1 people here/)).toBeVisible();
    await pages[0].screenshot({ path: "work/lobby-redesign-mobile.png", fullPage: true });
  } finally { await Promise.all(contexts.map(c => c.close())); }
});
