import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { api, env } from "../business";

test.use({ trace: "off" });
test.describe.configure({ retries: 0 });
test.skip(process.env.E2E_BUSINESS !== "1", "Requires staging business data");

test("Create Product → Approve Product → Create Proposition → Create Plan", async ({ request }) => {
  const owner = env("E2E_ENTERPRISE_TOKEN");
  const reviewer = env("E2E_PRODUCT_APPROVER_TOKEN");
  const partner = env("E2E_PARTNER_ID");
  const brand = env("E2E_BRAND_ID");
  const region = env("E2E_REGION");
  const code = "E2E-" + randomUUID().slice(0, 8);
  const product = await api(request, owner, "products", "POST", 201, {
    type: "STANDALONE", name: code, code, category: "Meals",
    pricing: { sellingPrice: 120000, costPrice: 85000, currency: "VND" },
  });
  expect(product.status).toBe("DRAFT");
  const path = `products/${product.id}`;
  expect((await api(request, owner, path + "/submit", "POST", 200)).status).toBe("PENDING_REVIEW");
  const approved = await api(request, reviewer, path + "/approve", "POST", 200);
  expect(approved.status).toBe("APPROVED");
  const processes = await api(request, owner, path + "/processes", "GET", 200);
  const source = processes.find((p: { version: number; status: string }) =>
    p.version === approved.version && p.status === "APPROVED");
  expect(source?.id).toBeTruthy();
  const proposition = await api(request, owner, "propositions", "POST", 201, {
    productId: product.id, productVersion: approved.version, productProcessId: source.id,
    definition: { name: code + "-proposition", regionIds: [region], brandId: brand,
      distributionPartnerIds: [partner], enterpriseProfitShare: "60", platformProfitShare: "10",
      distributionProfitShare: "30", targetYear: new Date().getUTCFullYear(), expectRevenue: "1000" },
  });
  expect(proposition.productProcessId).toBe(source.id);
  const plans = `propositions/${proposition.id}/plans`;
  const name = code + "-plan";
  const updated = await api(request, owner, plans, "POST", 201, {
    expectedRevision: proposition.revision, name, regionIds: [region], tenantIds: [partner],
    marketConfiguration: { salePrice: 25, taxRate: 8, surcharge: 1 },
  });
  const plan = updated.plans.find((p: { name: string }) => p.name === name);
  expect(plan?.id).toBeTruthy();
  expect(await api(request, owner, plans + "/" + plan.id, "GET", 200))
    .toMatchObject({ id: plan.id, name, tenantIds: [partner], regionIds: [region] });
});
