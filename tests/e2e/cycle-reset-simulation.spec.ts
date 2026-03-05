import { expect, test } from "@playwright/test";

test("simulated next day reopens recurring missions", async ({ page }) => {
  const missionTitle = "Operation: Brush Teeth";

  await page.goto("/hero/captain-alpha");

  const missionCard = page.locator("article").filter({ hasText: missionTitle }).first();
  await expect(missionCard).toBeVisible();

  await missionCard.getByRole("button").first().click();
  await expect(missionCard.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.addInitScript(() => {
    const RealDate = Date;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(RealDate.now() + ONE_DAY_MS);
          return;
        }
        super(...args);
      }

      static now() {
        return RealDate.now() + ONE_DAY_MS;
      }

      static parse(value: string) {
        return RealDate.parse(value);
      }

      static UTC(...args: Parameters<typeof Date.UTC>) {
        return RealDate.UTC(...args);
      }
    }

    // @ts-expect-error runtime override for deterministic time simulation
    window.Date = MockDate;
  });

  await page.reload();

  const missionCardTomorrow = page
    .locator("article")
    .filter({ hasText: missionTitle })
    .first();

  await expect(missionCardTomorrow).toBeVisible();
  await expect(missionCardTomorrow.getByRole("button", { name: "Undo" })).toHaveCount(0);
});
