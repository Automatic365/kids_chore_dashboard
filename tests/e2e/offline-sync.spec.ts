import { expect, test } from "@playwright/test";

test("offline completion queues and syncs on reconnect", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_USE_REMOTE_API !== "true",
    "Requires remote API mode to exercise offline queue sync.",
  );

  const missionTitle = "Operation: Brush Teeth";

  // Force the completion request to fail once so the mission is queued offline.
  await page.route("**/api/public/complete-mission", async (route) => {
    await route.abort("failed");
    await page.unroute("**/api/public/complete-mission");
  });

  await page.goto("/hero/captain-alpha");

  const missionCard = page.locator("article").filter({ hasText: missionTitle }).first();
  await missionCard.getByRole("button").first().click();
  await expect(missionCard.getByRole("button", { name: "Undo" })).toBeVisible();

  const queuedBefore = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("hero-habits-offline", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction("completion-queue", "readonly");
    const store = tx.objectStore("completion-queue");
    const countReq = store.count();
    const count = await new Promise<number>((resolve, reject) => {
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => reject(countReq.error);
    });

    db.close();
    return count;
  });

  expect(queuedBefore).toBeGreaterThan(0);

  // Trigger sync listener.
  await page.evaluate(() => {
    window.dispatchEvent(new Event("online"));
  });

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open("hero-habits-offline", 1);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        const tx = db.transaction("completion-queue", "readonly");
        const store = tx.objectStore("completion-queue");
        const countReq = store.count();
        const count = await new Promise<number>((resolve, reject) => {
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        });

        db.close();
        return count;
      });
    })
    .toBe(0);

  await page.reload();
  const missionCardAfterReload = page
    .locator("article")
    .filter({ hasText: missionTitle })
    .first();
  await expect(missionCardAfterReload.getByRole("button", { name: "Undo" })).toBeVisible();
});
