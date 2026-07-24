import type { StaticImageData } from "next/image";

import dashboardDesktop from "../../../../docs/screenshots/publisher-dashboard-desktop.png";
import dashboardMobile from "../../../../docs/screenshots/publisher-dashboard-mobile.png";
import mediaDesktop from "../../../../docs/screenshots/publisher-media-desktop.png";
import mediaMobile from "../../../../docs/screenshots/publisher-media-mobile.png";
import screensDesktop from "../../../../docs/screenshots/publisher-screens-desktop.png";
import screensMobile from "../../../../docs/screenshots/publisher-screens-mobile.png";
import templatesDesktop from "../../../../docs/screenshots/s31b-templates-desktop.png";

export type MarketingImageId =
  | "product-publisher-desktop"
  | "product-publisher-mobile"
  | "product-media-library"
  | "product-media-mobile"
  | "product-screen-status"
  | "product-screen-mobile"
  | "product-templates";

export type MarketingImage = {
  alt: string;
  aspectRatio: string;
  id: MarketingImageId;
  src: StaticImageData;
  status: "approved";
  usage: string[];
};

export const marketingImages = {
  "product-publisher-desktop": {
    alt: "VeyoCast Publisher-overzicht met schermstatus, acties en publicatiegereedheid",
    aspectRatio: "16:10",
    id: "product-publisher-desktop",
    src: dashboardDesktop,
    status: "approved",
    usage: ["hero", "product", "publisher", "offline"]
  },
  "product-publisher-mobile": {
    alt: "Mobiele VeyoCast Publisher met de primaire beheertaken in één kolom",
    aspectRatio: "9:19.5",
    id: "product-publisher-mobile",
    src: dashboardMobile,
    status: "approved",
    usage: ["hero", "publisher", "mobile"]
  },
  "product-media-library": {
    alt: "VeyoCast-mediabibliotheek met filters, uploads en mediastatus",
    aspectRatio: "16:10",
    id: "product-media-library",
    src: mediaDesktop,
    status: "approved",
    usage: ["media", "features"]
  },
  "product-media-mobile": {
    alt: "VeyoCast-mediabibliotheek op een mobiel scherm",
    aspectRatio: "9:19.5",
    id: "product-media-mobile",
    src: mediaMobile,
    status: "approved",
    usage: ["media", "mobile"]
  },
  "product-screen-status": {
    alt: "VeyoCast-schermvloot met operationele status per gekoppeld scherm",
    aspectRatio: "16:10",
    id: "product-screen-status",
    src: screensDesktop,
    status: "approved",
    usage: ["screens", "monitoring", "product"]
  },
  "product-screen-mobile": {
    alt: "VeyoCast-schermbeheer op een mobiel scherm",
    aspectRatio: "9:19.5",
    id: "product-screen-mobile",
    src: screensMobile,
    status: "approved",
    usage: ["screens", "mobile"]
  },
  "product-templates": {
    alt: "VeyoCast-templatebibliotheek met bewerkbare clubcontent",
    aspectRatio: "16:10",
    id: "product-templates",
    src: templatesDesktop,
    status: "approved",
    usage: ["templates", "clubtv"]
  }
} as const satisfies Record<MarketingImageId, MarketingImage>;
