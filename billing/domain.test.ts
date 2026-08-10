import { describe, expect, test } from "bun:test";
import { effectiveInvoiceStatus, invoiceDates, periodKeyFor, previousPeriodKey } from "./domain";

describe("postpaid billing periods", () => {
  test("uses calendar months in Abidjan/UTC", () => {
    expect(periodKeyFor(new Date("2026-08-10T10:00:00Z"))).toBe("2026-08");
    expect(previousPeriodKey(new Date("2026-01-03T00:00:00Z"))).toBe("2025-12");
  });

  test("issues the invoice the following month with a seven day due date", () => {
    const dates = invoiceDates("2026-08");
    expect(dates.issuedAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(dates.dueAt.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(dates.graceEndsAt.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  test("only marks an unpaid invoice overdue after its due date", () => {
    const dueAt = new Date("2026-09-08T00:00:00Z");
    expect(effectiveInvoiceStatus("open", dueAt, new Date("2026-09-07T23:59:59Z"))).toBe("open");
    expect(effectiveInvoiceStatus("open", dueAt, new Date("2026-09-08T00:00:01Z"))).toBe("overdue");
    expect(effectiveInvoiceStatus("paid", dueAt, new Date("2026-10-01T00:00:00Z"))).toBe("paid");
  });
});

