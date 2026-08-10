import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { parsePayDunyaNotificationData } from "./paydunya";

const previousEnvironment = {
  principal: process.env.PAYDUNYA_PRINCIPAL_KEY,
  public: process.env.PAYDUNYA_PUBLIC_KEY,
  private: process.env.PAYDUNYA_PRIVATE_KEY,
  token: process.env.PAYDUNYA_TOKEN,
};

afterEach(() => {
  const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
  restore("PAYDUNYA_PRINCIPAL_KEY", previousEnvironment.principal);
  restore("PAYDUNYA_PUBLIC_KEY", previousEnvironment.public);
  restore("PAYDUNYA_PRIVATE_KEY", previousEnvironment.private);
  restore("PAYDUNYA_TOKEN", previousEnvironment.token);
});

function configureTestKeys() {
  process.env.PAYDUNYA_PRINCIPAL_KEY = "master-key-for-tests";
  process.env.PAYDUNYA_PUBLIC_KEY = "test-public";
  process.env.PAYDUNYA_PRIVATE_KEY = "test-private";
  process.env.PAYDUNYA_TOKEN = "test-token";
  return createHash("sha512").update("master-key-for-tests").digest("hex");
}

describe("PayDunya IPN", () => {
  test("accepts the nested URL-encoded structure sent by PayDunya", () => {
    const form = new FormData();
    form.set("data[hash]", configureTestKeys());
    form.set("data[invoice][token]", "test_invoice_123");
    form.set("data[status]", "completed");
    expect(parsePayDunyaNotificationData(form)).toEqual({ token: "test_invoice_123", status: "completed" });
  });

  test("rejects a notification with an invalid hash", () => {
    configureTestKeys();
    const form = new FormData();
    form.set("data[hash]", "invalid");
    form.set("data[invoice][token]", "test_invoice_123");
    form.set("data[status]", "completed");
    expect(parsePayDunyaNotificationData(form)).toBeUndefined();
  });
});
