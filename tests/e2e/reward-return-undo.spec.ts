import { expect, test } from "@playwright/test";

test("child can return reward to unlock undo", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto("/hero/captain-alpha");

  const brush = page.locator("article").filter({ hasText: "Operation: Brush Teeth" }).first();
  const lego = page.locator("article").filter({ hasText: "Defeat Lego Monsters" }).first();
  const bed = page.locator("article").filter({ hasText: "Shield-Up Bedtime" }).first();

  await brush.getByRole("button").first().click();
  await lego.getByRole("button").first().click();
  await bed.getByRole("button").first().click();

  const heroSticker = page.locator("article").filter({ hasText: "Hero Sticker" }).first();
  await heroSticker.getByRole("button", { name: "Claim" }).click();

  const legoUndo = lego.getByRole("button", { name: "Undo" });
  await expect(legoUndo).toBeVisible();
  await legoUndo.click();

  await expect(lego.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(heroSticker.getByRole("button", { name: "Claim" })).toBeVisible();
});
