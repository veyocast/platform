import { describe, expect, it } from "vitest";

import { buildDynamicTemplatePayloadMap } from "./player-dynamic-template-payload";
import { collectDynamicSnapshotMediaAssetIds } from "./player-release-envelope";

describe("dynamic template release payload", () => {
  it("bindt een immutable snapshot aan de gepubliceerde platformtemplate", () => {
    const snapshotId = "11111111-1111-4111-8111-111111111111";
    const versionId = "22222222-2222-4222-8222-222222222222";
    const templateId = "33333333-3333-4333-8333-333333333333";
    const payloads = buildDynamicTemplatePayloadMap({
      snapshots: [
        {
          id: snapshotId,
          snapshot_data_json: {
            news: { articles: [], sourceName: "Clubnieuws" },
            type: "news"
          },
          source_revision_hash: "b".repeat(64),
          template_version_id: versionId
        }
      ],
      templates: [
        {
          id: templateId,
          orientation: "landscape",
          slide_type: "news",
          slug: "news-editorial-dark-landscape"
        }
      ],
      versions: [{ id: versionId, template_id: templateId }]
    });

    expect(payloads.get(snapshotId)).toMatchObject({
      orientation: "landscape",
      slideType: "news",
      snapshotHash: "b".repeat(64),
      templateSlug: "news-editorial-dark-landscape"
    });
  });

  it("laat een snapshot zonder bekende platformtemplate weg", () => {
    const payloads = buildDynamicTemplatePayloadMap({
      snapshots: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          snapshot_data_json: {},
          source_revision_hash: "c".repeat(64),
          template_version_id: "22222222-2222-4222-8222-222222222222"
        }
      ],
      templates: [],
      versions: []
    });

    expect(payloads.size).toBe(0);
  });

  it("verzamelt alleen begrensde UUID-mediareferenties uit een nieuwssnapshot", () => {
    expect(collectDynamicSnapshotMediaAssetIds({
      news: {
        articles: [
          {
            heroMediaAssetId: "33333333-3333-4333-8333-333333333333"
          },
          { heroMediaAssetId: "javascript:alert(1)" }
        ],
        providerLogoMediaAssetId:
          "44444444-4444-4444-8444-444444444444"
      }
    })).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "33333333-3333-4333-8333-333333333333"
    ]);
  });
});
