import {
  DOMParser,
  XMLSerializer,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode
} from "@xmldom/xmldom";

export class SvgSanitizationError extends Error {
  constructor(readonly code: "active-content" | "invalid-encoding" | "invalid-structure") {
    super(code);
    this.name = "SvgSanitizationError";
  }
}

const svgNamespace = "http://www.w3.org/2000/svg";
const maximumNodes = 20_000;
const allowedElements = new Set([
  "circle", "clippath", "defs", "desc", "ellipse", "g", "lineargradient",
  "line", "mask", "path", "polygon", "polyline", "radialgradient", "rect",
  "stop", "svg", "symbol", "text", "title", "tspan", "use"
]);
const forbiddenElements = new Set([
  "animate", "animatemotion", "animatetransform", "audio", "discard", "embed",
  "filter", "foreignobject", "iframe", "image", "mpath", "object",
  "script", "set", "style", "video"
]);
const allowedAttributes = new Set([
  "aria-hidden", "clip-path", "clip-rule", "cx", "cy", "d", "display", "dx",
  "dy", "fill", "fill-opacity", "fill-rule", "font-family", "font-size",
  "font-style", "font-weight", "height", "href", "id", "letter-spacing",
  "mask", "offset", "opacity", "pathlength", "points", "preserveaspectratio",
  "r", "role", "rx", "ry", "spreadmethod", "stop-color", "stop-opacity",
  "stroke", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap",
  "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-width",
  "text-anchor", "transform", "vector-effect", "viewbox", "visibility", "width",
  "x", "x1", "x2", "y", "y1", "y2"
]);

export function sanitizeSvgBytes(bytes: Uint8Array) {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SvgSanitizationError("invalid-encoding");
  }
  if (/<!doctype|<!entity|<\?(?:xml-stylesheet|php)/i.test(source)) {
    throw new SvgSanitizationError("active-content");
  }

  const document = parseSvg(source);
  const root = document.documentElement as XmlElement | null;
  if (!root || nodeName(root) !== "svg" || root.namespaceURI !== svgNamespace) {
    throw new SvgSanitizationError("invalid-structure");
  }

  let nodeCount = 0;
  sanitizeNode(root);
  const serialized = new XMLSerializer().serializeToString(root);
  const verified = parseSvg(serialized);
  if (!verified.documentElement || nodeName(verified.documentElement) !== "svg") {
    throw new SvgSanitizationError("invalid-structure");
  }
  return new TextEncoder().encode(serialized);

  function sanitizeNode(node: XmlNode) {
    nodeCount += 1;
    if (nodeCount > maximumNodes) throw new SvgSanitizationError("invalid-structure");

    for (const child of [...Array.from(node.childNodes)]) {
      if (child.nodeType === 8 || child.nodeType === 7) {
        node.removeChild(child);
        continue;
      }
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1) {
        node.removeChild(child);
        continue;
      }
      const element = child as XmlElement;
      const name = nodeName(element);
      if (forbiddenElements.has(name)) {
        throw new SvgSanitizationError("active-content");
      }
      if (element.namespaceURI !== svgNamespace || !allowedElements.has(name)) {
        node.removeChild(child);
        continue;
      }
      sanitizeElement(element);
      sanitizeNode(element);
    }
    if (node.nodeType === 1) sanitizeElement(node as XmlElement);
  }
}

export function isTintableSvgBytes(bytes: Uint8Array) {
  let document: XmlDocument;
  try {
    document = parseSvg(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return false;
  }
  const colors = new Set<string>();
  const visit = (node: XmlNode) => {
    if (node.nodeType !== 1) return true;
    const element = node as XmlElement;
    if (["lineargradient", "radialgradient", "pattern"].includes(
      nodeName(element)
    )) return false;
    for (const name of ["fill", "stroke", "stop-color"]) {
      const value = element.getAttribute(name)?.trim().toLowerCase();
      if (!value || value === "none" || value === "transparent" || value === "currentcolor") {
        continue;
      }
      if (value.includes("url(")) return false;
      colors.add(value);
      if (colors.size > 1) return false;
    }
    return Array.from(element.childNodes).every(visit);
  };
  return document.documentElement ? visit(document.documentElement) : false;
}

function sanitizeElement(element: XmlElement) {
  for (const attribute of [...Array.from(element.attributes)]) {
    const name = attribute.name.toLowerCase();
    const localName = (attribute.localName ?? attribute.name).toLowerCase();
    const value = attribute.value.trim();
    if (name === "xmlns" || name === "xmlns:xlink") continue;
    if (
      name.startsWith("on") ||
      name === "style" ||
      name === "src" ||
      name === "xlink:href"
    ) {
      throw new SvgSanitizationError("active-content");
    }
    if (!allowedAttributes.has(localName)) {
      element.removeAttributeNode(attribute);
      continue;
    }
    if (
      hasUnsafeControlCharacter(value) ||
      /(?:javascript|vbscript|data|https?|file)\s*:/i.test(value) ||
      /@import|expression\s*\(/i.test(value) ||
      (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z0-9_.:-]+\)$/i.test(value)) ||
      (localName === "href" && !/^#[A-Za-z0-9_.:-]+$/.test(value))
    ) {
      throw new SvgSanitizationError("active-content");
    }
  }
}

function hasUnsafeControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 && code !== 9 && code !== 10 && code !== 13;
  });
}

function parseSvg(source: string) {
  const errors: string[] = [];
  let document: XmlDocument;
  try {
    document = new DOMParser({
      onError: (level, message) => {
        if (level === "error" || level === "fatalError") errors.push(message);
      }
    }).parseFromString(source, "image/svg+xml");
  } catch {
    throw new SvgSanitizationError("invalid-structure");
  }
  if (errors.length || !document.documentElement) {
    throw new SvgSanitizationError("invalid-structure");
  }
  return document;
}

function nodeName(node: XmlElement) {
  return (node.localName ?? node.nodeName).toLowerCase();
}
