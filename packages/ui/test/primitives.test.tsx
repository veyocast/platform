import { readFile } from "node:fs/promises";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Badge,
  Button,
  Field,
  IconButton,
  Progress,
  TextInput
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

  it("uses css variables instead of hardcoded hex colors in component styles", async () => {
    const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

    expect(styles).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(styles).toContain("../../../tokens/veyocast-design-tokens.css");
  });
});
