import { Buffer } from "node:buffer";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const captureRoot = path.join(
  repositoryRoot,
  "docs",
  "screenshots",
  "fieldflow",
  "current"
);
const outputRoot = path.join(
  repositoryRoot,
  "docs",
  "screenshots",
  "fieldflow",
  "contact-sheets"
);
const referenceRoot = path.join(
  repositoryRoot,
  "docs",
  "screenshots",
  "fieldflow",
  "reference-targets"
);
const groups = [
  { columns: 5, expected: 30, name: "today", title: "Vandaag — statusmatrix" },
  { columns: 4, expected: 24, name: "studio-new", title: "Studio Nieuw — statematrix" },
  { columns: 2, expected: 10, name: "marketing-home", title: "Marketinghome — loaded, image-failure en opstelling" },
  { columns: 2, expected: 4, name: "control-shell", title: "Control-shell — responsive states" }
];
const exactComparisons = [
  {
    current: "reference-overview-1920x945.png",
    name: "overview",
    target: "target-overview-1920x945.png",
    title: "Overzicht — exact target versus current"
  },
  {
    current: "reference-planning-1920x945.png",
    name: "planning",
    target: "target-planning-1920x945.png",
    title: "Planning — exact target versus current"
  },
  {
    current: "reference-screens-1920x945.png",
    name: "screens",
    target: "target-screens-1920x945.png",
    title: "Schermen — exact target versus current"
  },
  {
    current: "reference-studio-1920x945.png",
    name: "studio",
    target: "target-studio-1920x945.png",
    title: "Studio — exact target versus current"
  },
  {
    current: "reference-marketing-full-1905x945.png",
    name: "marketing",
    target: "target-marketing-1905x5961.png",
    title: "Marketing — exact target versus current"
  }
];

const cellWidth = 400;
const imageHeight = 240;
const labelHeight = 38;
const headerHeight = 58;
const cellHeight = imageHeight + labelHeight;

await mkdir(outputRoot, { recursive: true });
const available = (await readdir(captureRoot)).filter((file) =>
  file.endsWith(".png")
);

for (const group of groups) {
  const files = available
    .filter((file) => file.startsWith(`${group.name}-`))
    .sort((left, right) => left.localeCompare(right, "nl"));

  if (files.length !== group.expected) {
    throw new Error(
      `${group.title}: verwacht ${group.expected} captures, vond ${files.length}.`
    );
  }

  const rows = Math.ceil(files.length / group.columns);
  const composites = [];

  for (const [index, file] of files.entries()) {
    const thumbnail = await sharp(path.join(captureRoot, file))
      .resize({
        background: "#f2efe7",
        fit: "contain",
        height: imageHeight - 16,
        width: cellWidth - 16
      })
      .png()
      .toBuffer();
    const metadata = await sharp(thumbnail).metadata();
    const left =
      (index % group.columns) * cellWidth +
      Math.round((cellWidth - (metadata.width ?? cellWidth)) / 2);
    const top =
      headerHeight +
      Math.floor(index / group.columns) * cellHeight +
      Math.round((imageHeight - (metadata.height ?? imageHeight)) / 2);

    composites.push({ input: thumbnail, left, top });
    composites.push({
      input: Buffer.from(labelSvg(file, cellWidth, labelHeight)),
      left: (index % group.columns) * cellWidth,
      top: headerHeight + Math.floor(index / group.columns) * cellHeight + imageHeight
    });
  }

  composites.push({
    input: Buffer.from(headerSvg(group.title, group.columns * cellWidth, headerHeight)),
    left: 0,
    top: 0
  });

  await sharp({
    create: {
      background: "#f2efe7",
      channels: 4,
      height: headerHeight + rows * cellHeight,
      width: group.columns * cellWidth
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputRoot, `${group.name}-contact-sheet.png`));
}

const comparisonCellWidth = 900;
const comparisonInset = 12;

for (const comparison of exactComparisons) {
  const targetPath = path.join(referenceRoot, comparison.target);
  const currentPath = path.join(captureRoot, comparison.current);
  const availableWidth = comparisonCellWidth - comparisonInset * 2;
  const [targetMetadata, currentMetadata] = await Promise.all([
    sharp(targetPath).metadata(),
    sharp(currentPath).metadata()
  ]);
  const scaledTargetHeight = scaledHeight(targetMetadata, availableWidth);
  const scaledCurrentHeight = scaledHeight(currentMetadata, availableWidth);
  const comparisonImageHeight = Math.max(
    scaledTargetHeight,
    scaledCurrentHeight
  ) + comparisonInset * 2;
  const comparisonHeight =
    headerHeight + comparisonImageHeight + labelHeight;
  const comparisonWidth = comparisonCellWidth * 2;
  const [targetImage, currentImage] = await Promise.all([
    sharp(targetPath).resize({ width: availableWidth }).png().toBuffer(),
    sharp(currentPath).resize({ width: availableWidth }).png().toBuffer()
  ]);

  await sharp({
    create: {
      background: "#f2efe7",
      channels: 4,
      height: comparisonHeight,
      width: comparisonWidth
    }
  })
    .composite([
      {
        input: Buffer.from(
          headerSvg(comparison.title, comparisonWidth, headerHeight)
        ),
        left: 0,
        top: 0
      },
      {
        input: targetImage,
        left: comparisonInset,
        top:
          headerHeight +
          comparisonInset +
          Math.round((Math.max(scaledTargetHeight, scaledCurrentHeight) - scaledTargetHeight) / 2)
      },
      {
        input: currentImage,
        left: comparisonCellWidth + comparisonInset,
        top:
          headerHeight +
          comparisonInset +
          Math.round((Math.max(scaledTargetHeight, scaledCurrentHeight) - scaledCurrentHeight) / 2)
      },
      {
        input: Buffer.from(labelSvg(`TARGET · ${comparison.target}`, comparisonCellWidth, labelHeight)),
        left: 0,
        top: headerHeight + comparisonImageHeight
      },
      {
        input: Buffer.from(labelSvg(`CURRENT · ${comparison.current}`, comparisonCellWidth, labelHeight)),
        left: comparisonCellWidth,
        top: headerHeight + comparisonImageHeight
      }
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputRoot, `exact-${comparison.name}-review-sheet.png`));
}

function scaledHeight(metadata, width) {
  if (!metadata.width || !metadata.height) {
    throw new Error("Een exact referentiebeeld heeft geen geldige afmetingen.");
  }
  return Math.round((metadata.height / metadata.width) * width);
}

function headerSvg(title, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#123332"/>
    <text x="20" y="36" fill="#fffdfc" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(title)}</text>
  </svg>`;
}

function labelSvg(label, width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="12" y="24" fill="#173b39" font-family="Arial, sans-serif" font-size="13" font-weight="600">${escapeXml(label)}</text>
  </svg>`;
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
