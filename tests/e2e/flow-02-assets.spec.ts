import { test, expect } from "@playwright/test";

test("Flow 02 - Built JavaScript and CSS assets are reachable", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  const urls = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)]
    .map((match) => match[1]);

  // Ensures we really tested a compiled frontend bundle rather than an empty HTML page.
  expect(urls.some((url) => /\.js(?:\?|$)/i.test(url))).toBeTruthy();

  for (const url of urls) {
    const assetResponse = await request.get(url);
    expect(assetResponse.status(), `Asset failed: ${url}`).toBe(200);
  }
});
