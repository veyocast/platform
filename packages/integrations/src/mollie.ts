import { z } from "zod";

const mollieModeSchema = z.enum(["test", "live"]);
const molliePaymentStatusSchema = z.enum(["open", "pending", "authorized", "paid", "failed", "canceled", "expired"]);
const moneySchema = z.object({ currency: z.literal("EUR"), value: z.string().regex(/^\d+\.\d{2}$/) });
const linkSchema = z.object({ href: z.string().url() });
const customerSchema = z.object({ id: z.string().regex(/^cst_[A-Za-z0-9]+$/), mode: mollieModeSchema });
const paymentSchema = z.object({
  _links: z.object({ checkout: linkSchema.optional(), changePaymentState: linkSchema.optional() }).passthrough(),
  amount: moneySchema,
  customerId: z.string().regex(/^cst_[A-Za-z0-9]+$/),
  id: z.string().regex(/^tr_[A-Za-z0-9]+$/),
  mandateId: z.string().regex(/^mdt_[A-Za-z0-9]+$/).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  mode: mollieModeSchema,
  sequenceType: z.enum(["first", "recurring", "oneoff"]),
  status: molliePaymentStatusSchema
});
const mandateSchema = z.object({ id: z.string().regex(/^mdt_[A-Za-z0-9]+$/), method: z.string(), mode: mollieModeSchema, status: z.enum(["pending", "valid", "invalid"]) });
const chargebackSchema = z.object({
  amount: moneySchema,
  id: z.string().regex(/^chb_[A-Za-z0-9]+$/),
  paymentId: z.string().regex(/^tr_[A-Za-z0-9]+$/)
});

export type MolliePayment = z.infer<typeof paymentSchema>;

export function formatMollieAmount(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError("Mollie amount must be non-negative integer cents");
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export class MollieClient {
  private readonly baseUrl = "https://api.mollie.com/v2/";
  constructor(private readonly apiKey: string, private readonly fetchImpl: typeof fetch = fetch) {
    if (!/^(test|live)_[A-Za-z0-9]+$/.test(apiKey)) throw new Error("Ongeldige Mollie API-keyconfiguratie.");
  }

  async createCustomer(input: { email: string; idempotencyKey: string; metadataId: string; name: string }) {
    return customerSchema.parse(await this.request("customers", { method: "POST", idempotencyKey: input.idempotencyKey, body: { email: input.email, metadata: { billingAccountId: input.metadataId }, name: input.name } }));
  }

  async createPayment(input: { amountCents: number; customerId: string; description: string; idempotencyKey: string; mandateId?: string; metadata: Record<string, string>; redirectUrl?: string; sequenceType: "first" | "recurring"; webhookUrl: string }) {
    return paymentSchema.parse(await this.request("payments", { method: "POST", idempotencyKey: input.idempotencyKey, body: {
      amount: { currency: "EUR", value: formatMollieAmount(input.amountCents) }, customerId: input.customerId,
      description: input.description, ...(input.mandateId ? { mandateId: input.mandateId } : {}), metadata: input.metadata,
      ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}), sequenceType: input.sequenceType, webhookUrl: input.webhookUrl
    } }));
  }

  async getPayment(paymentId: string) {
    if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Ongeldig Mollie payment-ID.");
    return paymentSchema.parse(await this.request(`payments/${paymentId}`));
  }

  async listMandates(customerId: string) {
    if (!/^cst_[A-Za-z0-9]+$/.test(customerId)) throw new Error("Ongeldig Mollie customer-ID.");
    const payload = z.object({ _embedded: z.object({ mandates: z.array(mandateSchema) }) }).parse(await this.request(`customers/${customerId}/mandates`));
    return payload._embedded.mandates;
  }

  async listPaymentChargebacks(paymentId: string) {
    if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) throw new Error("Ongeldig Mollie payment-ID.");
    const payload = z.object({ _embedded: z.object({ chargebacks: z.array(chargebackSchema) }) }).parse(await this.request(`payments/${paymentId}/chargebacks?limit=250`));
    return payload._embedded.chargebacks;
  }

  private async request(path: string, input: { body?: unknown; idempotencyKey?: string; method?: "POST" } = {}) {
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}`, ...(input.body ? { "Content-Type": "application/json" } : {}), ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}) },
      method: input.method ?? "GET",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Mollie request mislukt (${response.status}).`);
    return response.json();
  }
}
