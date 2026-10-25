import {collectSyncSportMediaAssetIds,sitesDynamicConfigurationSchema}from'@veyocast/contracts';

export function collectDynamicSnapshotMediaAssetIds(snapshot: unknown) {
  if (!isRecord(snapshot)) return [];
  const ids = new Set<string>();
  const sites=sitesDynamicConfigurationSchema.safeParse(snapshot.sitesConfiguration);if(sites.success&&sites.data.background?.kind==="tenant")ids.add(sites.data.background.mediaAssetId);
  const brand = isRecord(snapshot.brand) ? snapshot.brand : null;
  if (
    typeof brand?.logoMediaAssetId === "string" &&
    uuidPattern.test(brand.logoMediaAssetId)
  ) {
    ids.add(brand.logoMediaAssetId);
  }
  const menu = isRecord(snapshot.menu) ? snapshot.menu : null;
  if (Array.isArray(menu?.products)) {
    for (const value of menu.products.slice(0, 40)) {
      const product = isRecord(value) ? value : null;
      if (
        product &&
        typeof product.imageMediaAssetId === "string" &&
        uuidPattern.test(product.imageMediaAssetId)
      ) {
        ids.add(product.imageMediaAssetId);
      }
    }
  }
  const priceList = isRecord(snapshot.priceList) ? snapshot.priceList : null;
  if (Array.isArray(priceList?.sections)) {
    for (const sectionValue of priceList.sections.slice(0, 40)) {
      const section = isRecord(sectionValue) ? sectionValue : null;
      if (!Array.isArray(section?.products)) continue;
      for (const productValue of section.products.slice(0, 100)) {
        const product = isRecord(productValue) ? productValue : null;
        if (
          product?.photoVisible === true &&
          typeof product.imageMediaAssetId === "string" &&
          uuidPattern.test(product.imageMediaAssetId)
        ) {
          ids.add(product.imageMediaAssetId);
        }
      }
    }
  }
  const menuDocument = isRecord(snapshot.menuDocument)
    ? snapshot.menuDocument
    : null;
  if (Array.isArray(menuDocument?.assets)) {
    for (const value of menuDocument.assets.slice(0, 100)) {
      const asset = isRecord(value) ? value : null;
      if (
        typeof asset?.assetId === "string" &&
        uuidPattern.test(asset.assetId)
      ) {
        ids.add(asset.assetId);
      }
    }
  }
  const sport = isRecord(snapshot.sport) ? snapshot.sport : null;
  const arrivalConfig = isRecord(sport?.arrivalConfig) ? sport.arrivalConfig : null;
  if (
    arrivalConfig?.showSponsor === true &&
    typeof arrivalConfig.sponsorMediaAssetId === "string" &&
    uuidPattern.test(arrivalConfig.sponsorMediaAssetId)
  ) {
    ids.add(arrivalConfig.sponsorMediaAssetId);
  }
  if (Array.isArray(sport?.items)) {
    for (const value of sport.items.slice(0, 100)) {
      const item = isRecord(value) ? value : null;
      if (
        item &&
        typeof item.logoMediaAssetId === "string" &&
        uuidPattern.test(item.logoMediaAssetId)
      ) {
        ids.add(item.logoMediaAssetId);
      }
      if (
        item &&
        typeof item.photoMediaAssetId === "string" &&
        uuidPattern.test(item.photoMediaAssetId)
      ) {
        ids.add(item.photoMediaAssetId);
      }
      for (const key of ["homeLogoMediaAssetId", "awayLogoMediaAssetId"] as const) {
        if (typeof item?.[key] === "string" && uuidPattern.test(item[key])) {
          ids.add(item[key]);
        }
      }
    }
  }
  for(const id of collectSyncSportMediaAssetIds(snapshot))ids.add(id);
  const news = isRecord(snapshot.news) ? snapshot.news : null;
  if (!news) return [...ids];
  if (
    typeof news.providerLogoMediaAssetId === "string" &&
    uuidPattern.test(news.providerLogoMediaAssetId)
  ) {
    ids.add(news.providerLogoMediaAssetId);
  }
  if (Array.isArray(news.articles)) {
    for (const value of news.articles.slice(0, 50)) {
      const article = isRecord(value) ? value : null;
      if (
        article &&
        typeof article.heroMediaAssetId === "string" &&
        uuidPattern.test(article.heroMediaAssetId)
      ) {
        ids.add(article.heroMediaAssetId);
      }
      if (
        article &&
        typeof article.qrMediaAssetId === "string" &&
        uuidPattern.test(article.qrMediaAssetId)
      ) {
        ids.add(article.qrMediaAssetId);
      }
    }
  }
  return [...ids];
}

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
