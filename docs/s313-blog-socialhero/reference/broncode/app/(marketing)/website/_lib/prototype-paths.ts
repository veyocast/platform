/** Public marketing and Control share one origin in the Sites prototype. */
export function marketingHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  if (/^\/blog(?:[/?#]|$)/.test(href)) return href;
  return href === "/" ? "/website" : `/website${href}`;
}

export const prototypeControlHref = "/dashboard";
