import { describe, expect, it, vi } from "vitest";
import { MollieClient, formatMollieAmount } from "../src/mollie";

describe("Mollie adapter", () => {
  it("formats integer cents without floats", () => {
    expect(formatMollieAmount(1)).toBe("0.01");
    expect(formatMollieAmount(595)).toBe("5.95");
    expect(() => formatMollieAmount(5.95)).toThrow();
  });

  it("creates first payments with a permanent local idempotency key", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({
        _links: { checkout: { href: "https://www.mollie.com/checkout/test" } }, amount: { currency: "EUR", value: "0.01" }, customerId: "cst_Test123", id: "tr_Test123", mode: "test", sequenceType: "first", status: "open"
      }), { status: 200 });
    });
    const client = new MollieClient("test_abcdefghijklmnopqrstuvwxyz", fetchMock as unknown as typeof fetch);
    await client.createPayment({ amountCents: 1, customerId: "cst_Test123", description: "VeyoCast betaalmethode", idempotencyKey: "attempt-1", metadata: { attemptId: "opaque" }, redirectUrl: "https://control.test/return", sequenceType: "first", webhookUrl: "https://control.test/webhook" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("attempt-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: { currency: "EUR", value: "0.01" }, sequenceType: "first" });
  });

  it("rejects provider identity drift", async () => {
    const client = new MollieClient("test_abcdefghijklmnopqrstuvwxyz", async () => new Response(JSON.stringify({ id: "wrong", mode: "live" }), { status: 200 }));
    await expect(client.getPayment("tr_Test123")).rejects.toThrow();
  });

  it("reads chargebacks from the dedicated provider resource", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({ _embedded: { chargebacks: [{ amount: { currency: "EUR", value: "5.95" }, id: "chb_Test123", paymentId: "tr_Test123" }] } }), { status: 200 });
    });
    const client = new MollieClient("test_abcdefghijklmnopqrstuvwxyz", fetchMock as unknown as typeof fetch);
    await expect(client.listPaymentChargebacks("tr_Test123")).resolves.toHaveLength(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("payments/tr_Test123/chargebacks?limit=250");
  });
});
