import { afterEach, describe, expect, test } from "bun:test";
import { getPaymentBaseUrl, getRequestOrigin } from "./config";

const originalAppBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  if (originalAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalAppBaseUrl;
});

describe("public origins", () => {
  test("authentication always returns to the origin that received the request", () => {
    process.env.APP_BASE_URL = "http://localhost:3000";
    expect(getRequestOrigin("https://bibata.example/auth/google")).toBe("https://bibata.example");
  });

  test("payment callbacks can still use the explicitly configured public origin", () => {
    process.env.APP_BASE_URL = "https://payments.bibata.example/";
    expect(getPaymentBaseUrl("https://preview.vercel.app/api/billing/checkout")).toBe("https://payments.bibata.example");
  });
});
