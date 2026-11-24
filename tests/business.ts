import { expect, type APIRequestContext } from "@playwright/test";

export function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing staging configuration: ${name}`);
  return value;
}

export async function api(request: APIRequestContext, token: string, path: string,
  method: "GET" | "POST", status: number, data?: unknown) {
  const url = new URL("/api/v1/" + path, env("E2E_API_URL"));
  const response = await request.fetch(url.href, {
    method, data, maxRedirects: 0, headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.status(), `${method} ${url.pathname}`).toBe(status);
  return response.json();
}
