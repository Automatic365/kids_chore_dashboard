import { expect, test } from "@playwright/test";

test("renders hero select page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Choose Your Hero")).toBeVisible();
  await expect(page.getByRole("link", { name: /Captain Comet/i })).toBeVisible();
});
