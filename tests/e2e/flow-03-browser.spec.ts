import { test, expect } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test("Flow 03 - Chromium can open frontend HTML without external authentication", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);
  await expect(page.locator("html")).toBeVisible();
  await expect(page.locator("script[src]").first()).toHaveAttribute("src", /\.js(?:\?|$)/);
});
