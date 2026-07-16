import type { ComponentPropsWithoutRef, CSSProperties } from "react";

import { cn } from "../utils";

type CssVars = CSSProperties & Record<string, string | number | undefined>;

export function Box({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={className} {...props} />;
}

export type StackProps = ComponentPropsWithoutRef<"div"> & {
  direction?: "vertical" | "horizontal";
  gap?: string;
};

export function Stack({
  className,
  direction = "vertical",
  gap,
  style,
  ...props
}: StackProps) {
  const stackStyle: CssVars = { ...style, "--cv-stack-gap": gap };

  return (
    <div
      className={cn("cv-stack", `cv-stack--${direction}`, className)}
      style={stackStyle}
      {...props}
    />
  );
}

export type GridProps = ComponentPropsWithoutRef<"div"> & {
  columns?: number | string;
  gap?: string;
  minItemWidth?: string;
};

export function Grid({ className, columns, gap, minItemWidth, style, ...props }: GridProps) {
  const gridColumns = typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns;
  const gridStyle: CssVars = {
    ...style,
    "--cv-grid-columns": gridColumns,
    "--cv-grid-gap": gap,
    "--cv-grid-min": minItemWidth
  };

  return <div className={cn("cv-grid", className)} style={gridStyle} {...props} />;
}

export type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  size?: "reading" | "content" | "wide";
};

export function Container({ className, size = "content", ...props }: ContainerProps) {
  return <div className={cn("cv-container", `cv-container--${size}`, className)} {...props} />;
}

export type AspectRatioProps = ComponentPropsWithoutRef<"div"> & {
  ratio?: "16:9" | "9:16" | "1:1" | string | number;
};

export function AspectRatio({ className, ratio = "16:9", style, ...props }: AspectRatioProps) {
  const ratioValue = typeof ratio === "number" ? String(ratio) : ratio.replace(":", " / ");
  const aspectStyle: CssVars = { ...style, "--cv-aspect-ratio": ratioValue };

  return <div className={cn("cv-aspect-ratio", className)} style={aspectStyle} {...props} />;
}

export type DividerProps = ComponentPropsWithoutRef<"div"> & {
  orientation?: "horizontal" | "vertical";
};

export function Divider({ className, orientation = "horizontal", ...props }: DividerProps) {
  return (
    <div
      aria-orientation={orientation}
      className={cn("cv-divider", `cv-divider--${orientation}`, className)}
      role="separator"
      {...props}
    />
  );
}

export function VisuallyHidden({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return <span className={cn("cv-visually-hidden", className)} {...props} />;
}
