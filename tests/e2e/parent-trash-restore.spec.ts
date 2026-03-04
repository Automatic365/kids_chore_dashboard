import { expect, test } from "@playwright/test";

test("parent can move a mission to trash and restore it", async ({ page }) => {
  await page.goto("/parent");

  const pin =
    process.env.PARENT_PIN_PLAIN ??
    process.env.NEXT_PUBLIC_PARENT_PIN_PLAIN ??
    "1234";

  const pinInput = page.getByPlaceholder("••••");
  if (await pinInput.isVisible().catch(() => false)) {
    await pinInput.fill(pin);
    await page.getByRole("button", { name: "Unlock" }).click();
  }

  await expect(page.getByRole("heading", { name: "Manage Missions" })).toBeVisible();

  const manageSection = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Manage Missions" }),
  });
  const missionCard = manageSection.locator("article").first();
  await expect(missionCard).toBeVisible();
  const missionTitle = await missionCard.locator("input").first().inputValue();

  page.on("dialog", (dialog) => void dialog.accept());
  await missionCard.getByRole("button", { name: "Trash" }).click();

  const trashSection = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Trash" }) });
  const trashedCard = trashSection.locator("article").filter({ hasText: missionTitle }).first();
  await expect(trashedCard).toBeVisible();
  await trashedCard.getByRole("button", { name: "Restore" }).click();

  await expect(trashSection.getByText("Trash is empty.")).toBeVisible();
});
