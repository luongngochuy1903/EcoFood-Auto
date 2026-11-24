import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { api, env } from "../business";

test.use({ trace: "off" });
test.describe.configure({ retries: 0 });
test.skip(process.env.E2E_BUSINESS !== "1", "Requires a connected HashCore sandbox");

test("Submit Transaction qua HashCore (200) → Verify Dashboard", async ({ request }) => {
  test.setTimeout(150000);
  const invoiceNumber = "E2E-" + randomUUID();
  const template = readFileSync(env("E2E_HASHCORE_PAYLOAD_FILE"), "utf8");
  expect(template.includes("{{invoiceNumber}}"), "Include {{invoiceNumber}} in the sandbox payload").toBe(true);
  const data = JSON.parse(template.replaceAll("{{invoiceNumber}}", invoiceNumber)
    .replaceAll("{{transactionTime}}", new Date().toISOString()));
  const token = env("E2E_DASHBOARD_TOKEN");
  const reader = env("E2E_TRANSACTION_READ_TOKEN");
  const tenantId = env("E2E_SALE_TENANT_ID");
  const propositionId = env("E2E_SALE_PROPOSITION_ID");
  const currency = env("E2E_SALE_CURRENCY");
  const query = new URLSearchParams({ tenantId, propositionId, currency, period: "MONTHLY" });
  const volume = async () => {
    const summary = await api(request, token, "dashboard/summary?" + query, "GET", 200);
    const actual = summary.metrics.totalSalesVolume.actual;
    expect(actual).toBeDefined();
    expect(actual).not.toBeNull();
    const value = Number(actual);
    expect(Number.isSafeInteger(value)).toBe(true);
    return value;
  };
  const before = await volume();
  const headers = JSON.parse(process.env.E2E_HASHCORE_HEADERS_JSON || "{}");
  const response = await request.post(env("E2E_HASHCORE_SUBMIT_URL"), { data, headers, maxRedirects: 0 });
  expect(response.status(), "HashCore sandbox submit response").toBe(200);
  await expect.poll(async () => {
    const invoices = await api(request, reader, "transactions?size=100", "GET", 200);
    return invoices.content.find((invoice: { invoiceNumber: string }) => invoice.invoiceNumber === invoiceNumber);
  }, { timeout: 45000, intervals: [1000, 2000] }).toMatchObject({
    invoiceNumber, tenantId, propositionId, currency, status: "ACCEPTED", paymentStatus: "PAID",
  });
  await expect.poll(volume, { timeout: 90000, intervals: [1000, 3000, 5000] }).toBe(before + 1);
});
