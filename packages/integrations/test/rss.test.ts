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

  it("kiest de grootste gedeclareerde full-size mediavariant boven thumbnails", () => {
    const feed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Beeldnieuws</title>
        <item>
          <guid>beeldkwaliteit-1</guid>
          <title>Wedstrijdverslag</title>
          <link>https://example.org/nieuws/wedstrijdverslag</link>
          <media:thumbnail url="/images/thumbnail.jpg" width="4000" height="3000"/>
          <media:content type="image/jpeg" url="/images/medium.jpg"
            width="960" height="540"/>
          <media:content medium="image" url="/images/original.jpg"
            width="2560" height="1440"/>
        </item>
      </channel></rss>`,
      "https://example.org/rss.xml"
    );

    expect(feed.media.articleImages).toEqual([{
      externalId: "beeldkwaliteit-1",
      url: "https://example.org/images/original.jpg"
    }]);
  });

  it("accepteert een media-afbeelding zonder optionele typehint", () => {
    const feed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Beeldnieuws</title>
        <item>
          <guid>beeldkwaliteit-zonder-type</guid>
          <title>Wedstrijdverslag</title>
          <link>https://example.org/nieuws/wedstrijdverslag</link>
          <media:content url="/images/original-zonder-type.jpg"
            width="2560" height="1440"/>
          <media:thumbnail url="/images/thumbnail.jpg"/>
        </item>
      </channel></rss>`,
      "https://example.org/rss.xml"
    );

    expect(feed.media.articleImages[0]?.url).toBe(
      "https://example.org/images/original-zonder-type.jpg"
    );
  });

  it("gebruikt de grootste HTML-srcset of data-src en valt veilig terug op full-size media", () => {
    const srcsetFeed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Lazy beeldnieuws</title>
        <item>
          <guid>beeldkwaliteit-2</guid>
          <title>Nieuwe trainer</title>
          <link>https://example.org/nieuws/trainer</link>
          <media:thumbnail url="/images/feed-thumb.jpg" width="2000" height="2000"/>
          <description><![CDATA[
            <img width="800" height="450"
              src="/images/placeholder.jpg"
              data-src="/images/lazy-original.jpg"
              srcset="/images/story-640.jpg 640w, /images/story-1920.jpg 1920w" />
          ]]></description>
        </item>
      </channel></rss>`,
      "https://example.org/rss.xml"
    );
    expect(srcsetFeed.media.articleImages[0]?.url).toBe(
      "https://example.org/images/story-1920.jpg"
    );

    const dataSrcFeed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Lazy bron</title>
        <item>
          <guid>beeldkwaliteit-data-src</guid>
          <title>Clubbericht</title>
          <link>https://example.org/nieuws/clubbericht</link>
          <description><![CDATA[
            <img src="/images/lazy-placeholder.jpg"
              data-src="/images/lazy-full.jpg" />
          ]]></description>
          <media:thumbnail url="/images/feed-thumb.jpg" width="3000" height="3000"/>
        </item>
      </channel></rss>`,
      "https://example.org/rss.xml"
    );
    expect(dataSrcFeed.media.articleImages[0]?.url).toBe(
      "https://example.org/images/lazy-full.jpg"
    );

    const fallbackFeed = parseRssOrAtom(
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
        <title>Veilige fallback</title>
        <item>
          <guid>beeldkwaliteit-3</guid>
          <title>Teamnieuws</title>
          <link>https://example.org/nieuws/team</link>
          <enclosure type="image/jpeg" url="/images/full.jpg"/>
          <description><![CDATA[
            <img data-src="javascript:alert(1)" src="data:image/png;base64,AAAA" />
          ]]></description>
          <media:thumbnail url="/images/thumb.jpg" width="4096" height="4096"/>
        </item>
      </channel></rss>`,
      "https://example.org/rss.xml"
    );
    expect(fallbackFeed.media.articleImages[0]?.url).toBe(
      "https://example.org/images/full.jpg"
    );
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
