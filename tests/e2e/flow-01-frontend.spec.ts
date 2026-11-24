import { test, expect } from "@playwright/test";

test("Flow 01 - Frontend returns HTML successfully", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html.toLowerCase()).toContain("<html");
  expect(html.toLowerCase()).toContain("</html>");
});
