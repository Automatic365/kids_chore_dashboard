import { expect, test } from "@playwright/test";

test("can undo a completed mission", async ({ page }) => {
  await page.goto("/hero/captain-alpha");

  const card = page
    .locator("article")
    .filter({ hasText: "Operation: Brush Teeth" })
    .first();

  await expect(card).toBeVisible();

  await card.getByRole("button").first().click();
  await expect(card.getByRole("button", { name: "Undo" })).toBeVisible();

  await card.getByRole("button", { name: "Undo" }).click();
  await expect(card.getByRole("button", { name: "Undo" })).toHaveCount(0);
});
