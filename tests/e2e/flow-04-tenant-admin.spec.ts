import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { api, env } from "../business";

test.use({ trace: "off", screenshot: "off" });
test.describe.configure({ retries: 0 });
test.skip(process.env.E2E_BUSINESS !== "1", "Requires staging SMTP and wildcard tenant frontend");

async function actionLink(request: APIRequestContext, email: string, realm: string, previousId = "") {
  const inbox = new URL("/api/mails", env("E2E_TEMPMAIL_URL"));
  const idp = new URL(env("E2E_KEYCLOAK_URL"));
  let result = { id: "", url: "" };
  await expect.poll(async () => {
    const search = await request.get(inbox.href, { params: { email } });
    expect(search.status()).toBe(200);
    const list = await search.json();
    expect(list.result, "TempMail.Plus inbox read").toBe(true);
    for (const message of list.mail_list) {
      const id = String(message.mail_id);
      if (id === previousId) continue;
      const detail = await request.get(inbox.href + "/" + encodeURIComponent(id), { params: { email } });
      expect(detail.status()).toBe(200);
      const body = await detail.json();
      expect(body.result, "TempMail.Plus message read").toBe(true);
      for (const raw of (String(body.html || "") + "\n" + String(body.text || "")).match(/https?:\/\/[^\s<>"']+/g) || []) {
        const link = new URL(raw.replace(/&amp;/g, "&"));
        if (link.origin === idp.origin && link.pathname.endsWith("/realms/" + realm + "/login-actions/action-token")) {
          result = { id, url: link.href };
          return true;
        }
      }
    }
    return false;
  }, { timeout: 60000, intervals: [2000, 5000] }).toBe(true);
  return result;
}

test("Onboarding Tenant → Verify Email → Admin Login", async ({ request, page, browser }) => {
  test.setTimeout(210000);
  const username = "e2e" + randomUUID().slice(0, 8);
  const password = randomUUID() + "aB9!";
  const email = randomUUID().replaceAll("-", "") + "@" + env("E2E_MAIL_DOMAIN");
  const origin = new URL(env("E2E_TENANT_BASE_URL"));
  origin.hostname = username + "." + origin.hostname;
  const tenant = await api(request, env("E2E_ONBOARD_TOKEN"), "tenants", "POST", 201, {
    tenantName: username, username, email, firstName: "Test", lastName: "Admin",
    domainUrl: origin.host, tenantType: "STANDALONE", partnerTypeCode: "ENTERPRISE",
    contact: { contactPartyName: "Test", contactPartyLastName: "Admin" },
  });
  const verification = await actionLink(request, email, tenant.realm);
  await page.goto(verification.url);
  const confirm = page.getByRole("link", { name: /proceed/i })
    .or(page.locator("form").getByRole("button", { name: /proceed|continue/i })).first();
  if (await confirm.isVisible()) await confirm.click();
  const newPassword = page.locator("#password-new");
  if (!(await newPassword.isVisible())) {
    // sendVerifyEmail can finish verification without setting the user's first credential.
    await page.goto(origin.origin);
    await page.locator('a[href*="reset-credentials"]').click();
    await page.locator("#username").fill(username);
    await page.locator('form input[type=submit], form button[type=submit]').first().click();
    await page.goto((await actionLink(request, email, tenant.realm, verification.id)).url);
    if (await confirm.isVisible()) await confirm.click();
  }
  await newPassword.fill(password);
  await page.locator("#password-confirm").fill(password);
  await page.locator('form input[type=submit], form button[type=submit]').first().click();
  await expect(newPassword).toBeHidden();

  const clean = await browser.newContext();
  try {
    const login = await clean.newPage();
    await login.goto(origin.origin);
    await login.locator("#username").fill(username);
    await login.locator("#password").fill(password);
    const exchanged = login.waitForResponse(r => r.url() === new URL("/api/v1/auth/exchange", env("E2E_API_URL")).href && r.request().method() === "POST");
    await login.locator("#kc-login").click();
    const response = await exchanged;
    expect(response.status()).toBe(200);
    const body = await response.json();
    const session = body.data ?? body;
    expect(session.keycloakClaims.email_verified).toBe(true);
    const claims = JSON.parse(Buffer.from(session.accessToken.split(".")[1], "base64url").toString());
    expect(claims.tenantId).toBe(tenant.tenantId);
    expect(claims.roles).toContain("ENTERPRISE_ADMIN");
  } finally {
    await clean.close();
  }
});
