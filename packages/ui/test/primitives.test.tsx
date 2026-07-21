import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Badge,
  Button,
  DataTable,
  Field,
  FilterBar,
  IconButton,
  Inspector,
  PageHeader,
  Progress,
  ResourceState,
  TextInput,
  Toolbar
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
      <FilterBar activeCount={2} clearHref="/dashboard/media" results="3 van 12 zichtbaar">
        <TextInput aria-label="Media zoeken" type="search" />
      </FilterBar>
    );
    expect(html).toContain("Filters (2)");
    expect(html).toContain("3 van 12 zichtbaar");
    expect(html).toContain("Filters wissen");
    expect(html).toContain("vc-filter-bar__content");
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
  });
});
