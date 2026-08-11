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
      canonicalLink: "https://example.com/nieuws/finale",
      externalId: "bericht-1",
      intro: "We zijn kampioen .",
      sourceName: "Clubnieuws",
      title: "Finale & feest"
    });
    expect(feed.articles[0]?.qrMediaAssetId).toBeNull();
  });

  it("houdt bij meerdere providerupdates van dezelfde artikellink alleen de nieuwste over", () => {
    const feed = parseRssOrAtom(
      `<rss><channel><title>Updates</title>
        <item><guid>oud</guid><title>Oude titel</title>
          <link>https://example.org/bericht/?utm_source=rss</link>
          <pubDate>Mon, 10 Aug 2026 10:00:00 GMT</pubDate></item>
        <item><guid>nieuw</guid><title>Bijgewerkte titel</title>
          <link>https://example.org/bericht?fbclid=provider</link>
          <pubDate>Mon, 10 Aug 2026 11:00:00 GMT</pubDate></item>
      </channel></rss>`,
      "https://example.org/feed.xml"
    );

    expect(feed.articles).toHaveLength(1);
    expect(feed.articles[0]).toMatchObject({
      canonicalLink: "https://example.org/bericht",
      externalId: "nieuw",
      title: "Bijgewerkte titel"
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

  it("ontdekt leverancierlogo en begrensde artikelbeelden naast de tekstsnapshot", () => {
    const feed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Voetbalnieuws</title>
        <image><url>/assets/logo.png</url></image>
        <item>
          <guid>bericht-met-beeld</guid>
          <title>Nieuwe aanwinst</title>
          <link>https://example.org/voetbal/aanwinst</link>
          <media:content type="image/jpeg" url="/media/aanwinst.jpg"/>
        </item>
      </channel></rss>`,
      "https://example.org/voetbal/rss.xml"
    );

    expect(feed.media).toEqual({
      articleImages: [{
        externalId: "bericht-met-beeld",
        url: "https://example.org/media/aanwinst.jpg"
      }],
      providerLogoUrl: "https://example.org/assets/logo.png"
    });
    expect(feed.articles[0]?.heroMediaAssetId).toBeNull();
  });

  it("negeert een externe legacy-DTD zonder deze op te halen", () => {
    const feed = parseRssOrAtom(
      `<?xml version="1.0"?>
      <!DOCTYPE rss PUBLIC "-//Netscape Communications//DTD RSS 0.91//EN"
        "https://example.com/rss-0.91.dtd">
      <rss version="2.0"><channel><title>PUBLIC nieuws</title><item>
        <title>SYSTEM blijft gewone tekst</title>
        <link>https://example.com/nieuws/1</link>
      </item></channel></rss>`,
      "https://example.com/feed.xml"
    );

    expect(feed).toMatchObject({
      articles: [{ title: "SYSTEM blijft gewone tekst" }],
      title: "PUBLIC nieuws"
    });
  });

  it("weigert interne entities, HTML en lege feeds", () => {
    expect(() =>
      parseRssOrAtom(
        "<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><rss/>",
        "https://example.com/feed"
      )
    ).toThrowError(RssParseError);
    expect(() =>
      parseRssOrAtom(
        "<!DOCTYPE html><html><title>Nieuws</title></html>",
        "https://example.com/nieuws"
      )
    ).toThrowError("webpagina");
    expect(() =>
      parseRssOrAtom("<rss><channel/></rss>", "https://example.com/feed")
    ).toThrowError("geen bruikbare nieuwsartikelen");
  });
});
