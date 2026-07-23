import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Badge,
  BulkActionBar,
  Button,
  CompactStats,
  DataTable,
  Dialog,
  DialogTrigger,
  Field,
  FilterBar,
  IconButton,
  Inspector,
  PageHeader,
  Progress,
  ResourceState,
  TextInput,
  Toolbar,
  getTablePreferencesStorageKey,
  parseTablePreferences
} from "../src";

describe("@veyocast/ui primitives", () => {
  it("renders semantic button variants with stable classes", () => {
    const html = renderToStaticMarkup(<Button variant="primary">Publish</Button>);

    expect(html).toContain("vc-button");
    expect(html).toContain("vc-button--primary");
    expect(html).toContain('type="button"');
  });

  it("requires an accessible name for icon-only buttons", () => {
    expect(() => renderToStaticMarkup(<IconButton>?</IconButton>)).toThrowError(
      "IconButton requires aria-label or aria-labelledby."
    );

    const html = renderToStaticMarkup(<IconButton aria-label="Search">?</IconButton>);
    expect(html).toContain('aria-label="Search"');
  });

  it("keeps badge text visible and marks the status dot decorative", () => {
    const html = renderToStaticMarkup(<Badge status="success">Online</Badge>);

    expect(html).toContain("Online");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("vc-badge--success");
  });

  it("wires field descriptions and errors to the control", () => {
    const html = renderToStaticMarkup(
      <Field description="Required for publishing." error="Choose a venue." id="venue" label="Venue">
        {({ controlProps }) => <TextInput {...controlProps} />}
      </Field>
    );

    expect(html).toContain('for="venue"');
    expect(html).toContain('aria-describedby="venue-description venue-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("renders determinate progress with aria values", () => {
    const html = renderToStaticMarkup(<Progress label="Upload progress" value={25} />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Upload progress"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain("--vc-progress-value:25%");
  });

  it("renders the shared resource page contract", () => {
    const html = renderToStaticMarkup(
      <>
        <PageHeader
          actions={<Button>Media uploaden</Button>}
          breadcrumbs={[{ href: "/dashboard", label: "Overzicht" }, { label: "Media" }]}
          description="Beheer media binnen de actieve vereniging."
          status={{ label: "Live tenantdata", tone: "success" }}
          title="Media"
        />
        <Toolbar summary="1 van 84 media-items">
          <TextInput aria-label="Media zoeken" type="search" />
        </Toolbar>
        <DataTable caption="Media binnen de actieve vereniging.">
          <thead><tr><th scope="col">Naam</th></tr></thead>
          <tbody><tr><td data-label="Naam">Welkomstscherm</td></tr></tbody>
        </DataTable>
        <Inspector description="Welkomstscherm" title="Mediadetail">
          <p>Gereed voor gebruik.</p>
        </Inspector>
      </>
    );

    expect(html).toContain('aria-label="Broodkruimel"');
    expect(html).toContain("vc-page-header__actions");
    expect(html).toContain("vc-toolbar__summary");
    expect(html).toContain("vc-data-table--responsive");
    expect(html).toContain("vc-inspector");
  });

  it("renders a responsive filter contract with results and reset action", () => {
    const html = renderToStaticMarkup(
      <FilterBar
        activeCount={2}
        clearHref="/dashboard/media"
        primary={<TextInput aria-label="Media zoeken" type="search" />}
        results="3 van 12 zichtbaar"
      >
        <TextInput aria-label="Type filteren" />
      </FilterBar>
    );
    expect(html).toContain('aria-label="Filters, 2 actief"');
    expect(html).toContain("vc-filter-bar__count");
    expect(html).toContain("3 van 12 zichtbaar");
    expect(html).toContain("Filters wissen");
    expect(html.indexOf("Media zoeken")).toBeLessThan(html.indexOf("vc-filter-bar__content"));
    expect(html).toContain("vc-filter-bar__content");
  });

  it("renders a compact semantic summary without card-only markup", () => {
    const html = renderToStaticMarkup(
      <CompactStats
        items={[
          { label: "Actie nodig", tone: "critical", value: 2 },
          { detail: "van 8", label: "Online", tone: "success", value: 6 }
        ]}
      />
    );

    expect(html).toContain("<dl");
    expect(html).toContain("<dt");
    expect(html).toContain("<dd");
    expect(html).toContain("vc-summary-strip__item--critical");
    expect(html).not.toContain("vc-card");
  });

  it("renders a shared, labelled bulk action region", () => {
    const html = renderToStaticMarkup(
      <BulkActionBar
        actions={<Button>Synchroniseren</Button>}
        description="Alleen actieve Players."
        title="2 schermen geselecteerd"
      />
    );

    expect(html).toContain('aria-label="2 schermen geselecteerd"');
    expect(html).toContain("vc-bulk-action-bar__actions");
    expect(html).toContain("Synchroniseren");
  });

  it("exposes a Radix-backed dialog trigger with a named button", () => {
    const html = renderToStaticMarkup(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Playlist maken</Button>
        </DialogTrigger>
      </Dialog>
    );

    expect(html).toContain("Playlist maken");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('data-state="closed"');
  });

  it("keeps required table columns visible and preserves new column defaults", () => {
    const columns = [
      { id: "name", label: "Naam", required: true },
      { id: "status", label: "Status" },
      { defaultVisible: false, id: "usage", label: "Gebruik" }
    ] as const;
    const stored = JSON.stringify({
      density: "compact",
      knownColumns: ["name"],
      version: 1,
      visibleColumns: []
    });
    const preferences = parseTablePreferences(stored, columns);

    expect(preferences.density).toBe("compact");
    expect(preferences.visibleColumns).toEqual(["name", "status"]);
    expect(getTablePreferencesStorageKey("media")).toBe(
      "veyocast:table:media:preferences"
    );
  });

  it("connects a preference key to the shared table contract", () => {
    const html = renderToStaticMarkup(
      <DataTable caption="Schermen" tableKey="screen-fleet">
        <thead>
          <tr>
            <th data-column="name" scope="col">Naam</th>
          </tr>
        </thead>
      </DataTable>
    );

    expect(html).toContain('data-vc-table-key="screen-fleet"');
    expect(html).toContain('data-column="name"');
  });

  it("exposes explicit loading, forbidden and stale states", () => {
    const loading = renderToStaticMarkup(
      <ResourceState kind="loading" title="Media laden" />
    );
    const forbidden = renderToStaticMarkup(
      <ResourceState kind="forbidden" title="Geen toegang">
        Vraag een beheerder om toegang.
      </ResourceState>
    );
    const stale = renderToStaticMarkup(
      <ResourceState kind="stale" title="Gegevens zijn verouderd">
        Vernieuw de pagina om de actuele status te laden.
      </ResourceState>
    );

    expect(loading).toContain('aria-busy="true"');
    expect(forbidden).toContain("vc-resource-state--forbidden");
    expect(stale).toContain("vc-alert--warning");
  });

  it("uses css variables instead of hardcoded hex colors in component styles", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(styles).toContain("../../../tokens/veyocast-design-tokens.css");
    expect(styles).toContain("var(--vc-motion-standard)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
