/* eslint-disable @next/next/no-img-element -- Preserve the supplied SVG element and intrinsic aspect ratio. */
import type { LucideIcon, LucideProps } from "lucide-react";
import type { ImgHTMLAttributes } from "react";
import { icons } from "./icons";

export function Icon({ name = "Circle", size = 18, ...props }: LucideProps & { name?: string }) {
  const key = name.replace(/(^|-)(\w)/g, (_match, _prefix: string, letter: string) => letter.toUpperCase());
  const catalog = icons as Record<string, LucideIcon>;
  const Component = catalog[name] ?? catalog[key] ?? icons.Circle;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />;
}

export function Brand({ light = false, iconOnly = false, className = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { light?: boolean; iconOnly?: boolean }) {
  return <img className={`brand ${className}`} src={`/assets/${iconOnly ? "brand-icon.svg" : light ? "full-light.svg" : "full-dark.svg"}`} alt="VeyoCast" {...props} />;
}
