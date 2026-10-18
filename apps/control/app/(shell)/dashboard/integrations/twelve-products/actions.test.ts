import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  capability: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("../../../../../lib/control-session", () => ({
  requireTenantCapability: f.capability,
  requireTenantControlSession: f.capability,
}));
vi.mock("../../../../../lib/supabase/server", () => ({
  createControlSupabaseClient: async () => ({
    rpc: f.rpc,
    from: (table: string) => {
      f.from(table);
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          f.eq(key, value);
          return query;
        },
        is: () => query,
        maybeSingle: async () => ({
          data: {
            name: "Stored product",
            description: null,
            category: "Dranken",
            price_cents: 235,
            vat_rate: 9,
            unit: "stuk",
            barcode: null,
            source_external_id: "0123",
          },
          error: null,
        }),
      };
      return query;
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: f.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
import {
  listProductsPage,
  manageProduct,
  setProductAvailability,
  updateProduct,
} from "./actions";
const tenant = "a1910000-0000-4000-8000-000000009001",
  product = "a1910000-0000-4000-8000-000000009002",
  source = "a1910000-0000-4000-8000-000000009003",
  command = "a1910000-0000-4000-8000-000000009004";
const availabilityValues = {
  name: "Stored product",
  description: null,
  category: "Dranken",
  priceCents: 235,
  vatRate: 9,
  unit: "stuk",
  barcode: null,
  externalId: "0123",
};
function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  f.capability.mockResolvedValue({ isLive: true, tenantId: tenant });
  f.rpc.mockResolvedValue({ data: { outcome: "updated" }, error: null });
});
describe("product commands use integer prices and server authorization", () => {
  it("keeps comma-decimal prices exact and preserves article identity through the guarded command", async () => {
    await expect(
      manageProduct(
        form({
          action: "update",
          productId: product,
          revision: "4",
          name: "Club product",
          price: "2,35",
          vatRate: "9",
          externalId: "ART-42",
          active: "on",
          idempotencyKey: command,
        }),
      ),
    ).rejects.toThrow("succes=product");
    expect(f.capability).toHaveBeenCalledWith("tenant.product.write");
    expect(f.rpc).toHaveBeenCalledWith(
      "manage_tenant_product_v2",
      expect.objectContaining({
        p_tenant_id: tenant,
        p_product_id: product,
        p_expected_revision: 4,
        p_idempotency_key: command,
        p_values: expect.objectContaining({
          priceCents: 235,
          externalId: "ART-42",
          active: true,
        }),
      }),
    );
  });
  it("rejects fractional-cent and malformed prices before storage", async () => {
    for (const price of ["2,355", "1e3", "-1", "1,234.56"])
      await expect(
        manageProduct(
          form({
            action: "update",
            productId: product,
            revision: "4",
            name: "Product",
            price,
          }),
        ),
      ).rejects.toThrow("fout=invoer");
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("creates only through the selected manual source with revision zero and stable idempotency", async () => {
    f.rpc.mockResolvedValue({ data: { outcome: "created" }, error: null });
    await expect(
      manageProduct(
        form({
          action: "create",
          dataSourceId: source,
          revision: "0",
          name: "Nieuw product",
          price: "0,00",
          active: "on",
          idempotencyKey: command,
        }),
      ),
    ).rejects.toThrow("succes=product");
    expect(f.rpc).toHaveBeenCalledWith(
      "manage_tenant_product_v2",
      expect.objectContaining({
        p_product_id: null,
        p_data_source_id: source,
        p_expected_revision: 0,
        p_values: expect.objectContaining({ priceCents: 0 }),
      }),
    );
  });
  it("reports conflicts without saved success or page invalidation", async () => {
    f.rpc.mockResolvedValue({
      data: { outcome: "conflict", actualRevision: 6 },
      error: null,
    });
    await expect(
      manageProduct(
        form({
          action: "delete",
          productId: product,
          revision: "4",
          idempotencyKey: command,
        }),
      ),
    ).rejects.toThrow("fout=conflict");
    expect(f.revalidate).not.toHaveBeenCalled();
  });
  it("removes using the guarded archive response and no invented product fields", async () => {
    f.rpc.mockResolvedValue({
      data: { outcome: "archived", frozenPublicationsPreserved: true },
      error: null,
    });
    await expect(
      manageProduct(
        form({
          action: "delete",
          productId: product,
          revision: "4",
          idempotencyKey: command,
        }),
      ),
    ).rejects.toThrow("succes=verwijderd");
    expect(f.rpc).toHaveBeenCalledWith(
      "manage_tenant_product_v2",
      expect.objectContaining({ p_action: "delete", p_values: {} }),
    );
  });
  it("keeps the historical edit action equally strict about fractional cents", async () => {
    await expect(
      updateProduct(
        form({
          productId: product,
          revision: "4",
          name: "Product",
          price: "2.355",
        }),
      ),
    ).rejects.toThrow("fout=invoer");
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

describe("beschikbaarheidsrij gebruikt bestaande atomic CAS-command", () => {
  it("herhaalt na verloren antwoord exact dezelfde opdracht zonder nieuwe productwaarden in te lezen", async () => {
    const input = {
      productId: product,
      expectedRevision: 4,
      active: false,
      idempotencyKey: command,
      values: availabilityValues,
    };
    f.rpc
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce({
        data: { outcome: "updated", revision: 5 },
        error: null,
      });
    expect(await setProductAvailability(input)).toMatchObject({ ok: false });
    expect(await setProductAvailability(input)).toEqual({
      ok: true,
      active: false,
      revision: 5,
    });
    expect(f.rpc.mock.calls[1]).toEqual(f.rpc.mock.calls[0]);
    expect(f.from).not.toHaveBeenCalled();
  });
  it("wijzigt uitsluitend de gevraagde beschikbaarheid met de oorspronkelijke productwaarden en tenantgebonden CAS", async () => {
    f.rpc.mockResolvedValue({
      data: { outcome: "updated", revision: 5 },
      error: null,
    });
    expect(
      await setProductAvailability({
        productId: product,
        expectedRevision: 4,
        active: false,
        idempotencyKey: command,
        values: availabilityValues,
      }),
    ).toEqual({ ok: true, active: false, revision: 5 });
    expect(f.from).not.toHaveBeenCalled();
    expect(f.rpc).toHaveBeenCalledWith(
      "manage_tenant_product_v2",
      expect.objectContaining({
        p_tenant_id: tenant,
        p_expected_revision: 4,
        p_idempotency_key: command,
        p_values: expect.objectContaining({
          active: false,
          priceCents: 235,
          externalId: "0123",
        }),
      }),
    );
  });
  it("laat stale conflicts en verbindingsproblemen zonder vals success of invalidatie", async () => {
    f.rpc.mockResolvedValue({
      data: { outcome: "conflict", actualRevision: 6 },
      error: null,
    });
    expect(
      await setProductAvailability({
        productId: product,
        expectedRevision: 4,
        active: false,
        idempotencyKey: command,
        values: availabilityValues,
      }),
    ).toMatchObject({ ok: false, conflict: true });
    expect(f.revalidate).not.toHaveBeenCalled();
    f.rpc.mockRejectedValue(new Error("private-db-detail"));
    const result = await setProductAvailability({
      productId: product,
      expectedRevision: 4,
      active: false,
      idempotencyKey: command,
      values: availabilityValues,
    });
    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("private-db-detail");
  });
});

describe("bounded product reads", () => {
  const filters = {
    query: "1005",
    category: "",
    availability: "all" as const,
    offset: 0,
  };
  function response() {
    return {
      rows: [
        {
          id: product,
          data_source_id: null,
          slug: "last-product",
          name: "Last product 1005",
          description: null,
          category: "Late category",
          price_cents: 235,
          vat_rate: 9,
          unit: "stuk",
          barcode: null,
          source_external_id: "1005",
          custom_fields: {},
          image_media_asset_id: null,
          active: true,
          revision: 4,
          updated_at: "2026-10-18T00:00:00Z",
        },
      ],
      count: 1,
      total: 1005,
      active: 1004,
      categories: ["Late category"],
      categoriesComplete: true,
      offset: 0,
      pageSize: 50,
    };
  }
  it("uses the authorized tenant and read capability for a complete filtered page", async () => {
    f.rpc.mockResolvedValue({ data: response(), error: null });
    const result = await listProductsPage(filters);
    expect(f.capability).toHaveBeenCalledWith("tenant.product.read");
    expect(f.rpc).toHaveBeenCalledWith("list_sync_products_v1", {
      p_tenant_id: tenant,
      p_query: "1005",
      p_category: "",
      p_availability: "all",
      p_offset: 0,
    });
    expect(result).toMatchObject({
      ok: true,
      page: {
        count: 1,
        total: 1005,
        active: 1004,
        products: [
          {
            id: product,
            name: "Last product 1005",
            priceCents: 235,
            revision: 4,
          },
        ],
      },
    });
  });
  it("rejects extra tenant selectors and invalid filters before a database request", async () => {
    for (const input of [
      { ...filters, tenantId: source },
      { ...filters, offset: -1 },
      { ...filters, query: "x".repeat(121) },
    ])
      expect(await listProductsPage(input)).toMatchObject({ ok: false });
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("does not turn missing rows or an inconsistent server response into an empty success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const data of [
        null,
        { ...response(), rows: [] },
        { ...response(), total: 0 },
      ]) {
        f.rpc.mockResolvedValue({ data, error: null });
        expect(await listProductsPage(filters)).toMatchObject({ ok: false });
      }
    } finally {
      log.mockRestore();
    }
  });
});
