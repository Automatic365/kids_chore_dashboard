import { expect, test } from "@playwright/test";

test("shows level-up celebration when crossing a hero tier", async ({ page }) => {
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });

  await page.goto("/parent");
  await page.locator('input[type="password"]').fill("1234");
  await page.getByRole("button", { name: "Unlock" }).click();

  const title = `Level Burst Protocol ${Date.now()}`;
  const addMission = page.locator("section").filter({ hasText: "Add Mission" }).first();
  await addMission.locator('select[name="profileId"]').selectOption("captain-alpha");
  await addMission.locator('input[name="title"]').fill(title);
  await addMission
    .locator('textarea[name="instructions"]')
    .fill("Complete this boost mission for instant XP.");
  await addMission.locator('input[name="powerValue"]').fill("60");
  await addMission.getByRole("button", { name: "Create Mission" }).click();

  await page.goto("/hero/captain-alpha");
  const card = page.locator("article").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button").first().click();

  await expect(page.getByText("Level Up")).toBeVisible();
  await page.getByRole("button", { name: "Keep Going" }).click();
  await expect(page.getByText("Level Up")).toHaveCount(0);
});
