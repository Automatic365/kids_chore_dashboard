import { expect, test } from "@playwright/test";

test("notification badge increments and clears after parent feed opens", async ({
  page,
}) => {
  await page.goto("/hero/captain-alpha");

  const card = page.locator("article").filter({ hasText: "Operation: Brush Teeth" }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button").first().click();

  await expect(page.getByTestId("parent-unread-badge")).toContainText("1", {
    timeout: 10000,
  });

  await page.goto("/parent");
  await page.locator('input[type="password"]').fill("1234");
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.getByRole("button", { name: "Show Feed" }).click();
  await expect(page.getByText("Mission Complete")).toBeVisible();

  await page.goto("/hero/captain-alpha");
  await expect(page.getByTestId("parent-unread-badge")).toHaveCount(0);
});
