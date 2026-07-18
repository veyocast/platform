import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const linkVariants = cva("vc-link", {
  variants: {
    variant: {
      default: "",
      muted: "vc-link--muted",
      nav: "vc-link--nav"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export type LinkProps = ComponentPropsWithoutRef<"a"> &
  VariantProps<typeof linkVariants> & {
    external?: boolean;
  };

export function Link({ className, external = false, rel, target, variant, ...props }: LinkProps) {
  return (
    <a
      className={cn(linkVariants({ variant }), className)}
      rel={external ? (rel ?? "noreferrer") : rel}
      target={external ? (target ?? "_blank") : target}
      {...props}
    />
  );
}
