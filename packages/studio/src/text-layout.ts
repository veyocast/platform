import type { StudioElement } from "./schema";

type StudioTextElement = Extract<StudioElement, { type: "text" }>;

export type StudioTextLayout = Readonly<{
  fontSize: number;
  lineHeightPx: number;
  lines: readonly string[];
}>;

export function layoutStudioText(element: StudioTextElement): StudioTextLayout {
  const availableWidth = Math.max(1, element.width - element.padding * 2);
  const availableHeight = Math.max(1, element.height - element.padding * 2);
  let fontSize = element.fontSize;
  let lines = wrapAtFontSize(element.text, availableWidth, fontSize, element.letterSpacing);
  let lineHeightPx = fontSize * element.lineHeight;

  if (element.autoFit) {
    while (
      fontSize > 12 &&
      (lines.length * lineHeightPx > availableHeight ||
        lines.some((line) =>
          estimateStudioTextWidth(line, fontSize, element.letterSpacing) >
          availableWidth
        ))
    ) {
      fontSize = Math.max(12, fontSize - 1);
      lineHeightPx = fontSize * element.lineHeight;
      lines = wrapAtFontSize(
        element.text,
        availableWidth,
        fontSize,
        element.letterSpacing
      );
    }
  }

  const maximumLines = Math.max(1, Math.floor(availableHeight / lineHeightPx));
  return {
    fontSize,
    lineHeightPx,
    lines: lines.slice(0, maximumLines)
  };
}

export function estimateStudioTextWidth(
  value: string,
  fontSize: number,
  letterSpacing: number
) {
  const characters = Array.from(value);
  const glyphWidth = characters.reduce(
    (sum, character) => sum + characterWidthFactor(character) * fontSize,
    0
  );
  return glyphWidth + Math.max(0, characters.length - 1) * letterSpacing;
}

function wrapAtFontSize(
  value: string,
  maximumWidth: number,
  fontSize: number,
  letterSpacing: number
) {
  return value.split("\n").flatMap((paragraph) =>
    wrapParagraph(paragraph, maximumWidth, fontSize, letterSpacing)
  );
}

function wrapParagraph(
  paragraph: string,
  maximumWidth: number,
  fontSize: number,
  letterSpacing: number
) {
  if (!paragraph) return [""];
  const words = paragraph.split(/\s+/u);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      if (estimateStudioTextWidth(word, fontSize, letterSpacing) <= maximumWidth) {
        current = word;
      } else {
        const fragments = splitLongWord(
          word,
          maximumWidth,
          fontSize,
          letterSpacing
        );
        lines.push(...fragments.slice(0, -1));
        current = fragments.at(-1) ?? "";
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (estimateStudioTextWidth(candidate, fontSize, letterSpacing) <= maximumWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    if (estimateStudioTextWidth(word, fontSize, letterSpacing) <= maximumWidth) {
      current = word;
      continue;
    }
    const fragments = splitLongWord(word, maximumWidth, fontSize, letterSpacing);
    lines.push(...fragments.slice(0, -1));
    current = fragments.at(-1) ?? "";
  }
  if (current) lines.push(current);
  return lines;
}

function splitLongWord(
  word: string,
  maximumWidth: number,
  fontSize: number,
  letterSpacing: number
) {
  const fragments: string[] = [];
  let current = "";
  for (const character of Array.from(word)) {
    const candidate = `${current}${character}`;
    if (
      current &&
      estimateStudioTextWidth(candidate, fontSize, letterSpacing) > maximumWidth
    ) {
      fragments.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) fragments.push(current);
  return fragments;
}

function characterWidthFactor(character: string) {
  if (character === " ") return 0.28;
  if (/[ilI1.,:;!'|]/u.test(character)) return 0.28;
  if (/[MW@%&#]/u.test(character)) return 0.82;
  if (/[A-Z0-9]/u.test(character)) return 0.62;
  return 0.52;
}
