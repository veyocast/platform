import { describe, expect, it } from "vitest";

import { parseRssOrAtom, RssParseError } from "../src/rss";

describe("RSS/Atom normalisatie", () => {
  it("normaliseert RSS zonder HTML uit de brontekst over te nemen", () => {
    const feed = parseRssOrAtom(
      `<?xml version="1.0"?>
      <rss><channel><title>Clubnieuws</title><item>
        <guid>bericht-1</guid><title><![CDATA[Finale &amp; feest]]></title>
        <description><![CDATA[<p>We zijn <strong>kampioen</strong>.</p>]]></description>
        <link>https://example.com/nieuws/finale</link>
        <pubDate>Sat, 25 Jul 2026 12:00:00 GMT</pubDate>
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    );

    expect(feed.title).toBe("Clubnieuws");
    expect(feed.articles[0]).toMatchObject({
      externalId: "bericht-1",
      intro: "We zijn kampioen .",
      sourceName: "Clubnieuws",
      title: "Finale & feest"
    });
  });

  it("normaliseert Atom alternate links", () => {
    const feed = parseRssOrAtom(
      `<feed><title>Updates</title><entry><id>urn:1</id>
      <title>Nieuwe openingstijd</title>
      <link rel="alternate" href="https://example.org/bericht"/>
      <updated>2026-07-27T10:00:00Z</updated>
      <summary>Vanaf maandag</summary></entry></feed>`,
      "https://example.org/atom"
    );
    expect(feed.articles[0]?.link).toBe("https://example.org/bericht");
  });

  it("weigert XML entities en lege feeds", () => {
    expect(() =>
      parseRssOrAtom(
        "<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rss/>",
        "https://example.com/feed"
      )
    ).toThrowError(RssParseError);
    expect(() =>
      parseRssOrAtom("<rss><channel/></rss>", "https://example.com/feed")
    ).toThrowError("geen bruikbare nieuwsartikelen");
  });
});
