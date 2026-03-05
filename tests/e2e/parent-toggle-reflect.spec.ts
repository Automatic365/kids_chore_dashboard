import { expect, test } from "@playwright/test";

test("parent mission active toggle is reflected on kid board", async ({ page }) => {
  const missionTitle = "Operation: Brush Teeth";

  await page.goto("/hero/captain-alpha");
  await expect(page.locator("article").filter({ hasText: missionTitle }).first()).toBeVisible();

  const parentPage = await page.context().newPage();
  await parentPage.goto("/parent");

  const pin =
    process.env.PARENT_PIN_PLAIN ??
    process.env.NEXT_PUBLIC_PARENT_PIN_PLAIN ??
    "1234";

  const pinInput = parentPage.getByPlaceholder("••••");
  if (await pinInput.isVisible().catch(() => false)) {
    await pinInput.fill(pin);
    await parentPage.getByRole("button", { name: "Unlock" }).click();
  }

  const manageSection = parentPage.locator("section").filter({
    has: parentPage.getByRole("heading", { name: "Manage Missions" }),
  });

  const missionRow = manageSection
    .locator("article")
    .filter({ has: parentPage.locator(`input[value=\"${missionTitle}\"]`) })
    .first();
  await expect(missionRow).toBeVisible();

  const activeCheckbox = missionRow
    .locator("label")
    .filter({ hasText: "Active" })
    .locator("input[type='checkbox']");

  await activeCheckbox.setChecked(false);
  await parentPage.waitForTimeout(900);

  await page.reload();
  await expect(page.locator("article").filter({ hasText: missionTitle })).toHaveCount(0);

  await activeCheckbox.setChecked(true);
  await parentPage.waitForTimeout(900);

  await page.reload();
  await expect(page.locator("article").filter({ hasText: missionTitle }).first()).toBeVisible();

  await parentPage.close();
});
