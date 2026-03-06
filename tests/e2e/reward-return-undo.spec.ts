import { expect, test } from "@playwright/test";

test("child can return reward to unlock undo", async ({ page }) => {
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  await page.goto("/hero/captain-alpha");

  const brush = page.locator("article").filter({ hasText: "Operation: Brush Teeth" }).first();
  const lego = page.locator("article").filter({ hasText: "Defeat Lego Monsters" }).first();
  const bed = page.locator("article").filter({ hasText: "Shield-Up Bedtime" }).first();

  await brush.getByRole("button").first().click();
  await lego.getByRole("button").first().click();
  await bed.getByRole("button").first().click();

  const heroSticker = page.locator("article").filter({ hasText: "Hero Sticker" }).first();
  await heroSticker.getByRole("button", { name: "Claim" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Claim" }).click();

  const legoUndo = lego.getByRole("button", { name: "Undo" });
  await expect(legoUndo).toBeVisible();
  await legoUndo.click();

  await page.getByRole("button", { name: "Show Trophy Case" }).click();
  const trophySection = page.locator("section").filter({ hasText: "Trophy Case" }).first();
  const trophyCard = trophySection
    .locator("article")
    .filter({ hasText: "Hero Sticker" })
    .first();
  await expect(trophyCard).toBeVisible();
  await trophyCard.getByRole("button", { name: "Give Back" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Give Back" }).click();

  await legoUndo.click();

  await expect(lego.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(heroSticker.getByRole("button", { name: "Claim" })).toBeVisible();
});
