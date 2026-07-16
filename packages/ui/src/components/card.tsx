import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "../utils";

export const cardVariants = cva("cv-card", {
  variants: {
    variant: {
      default: "",
      interactive: "cv-card--interactive",
      selected: "cv-card--selected"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export type CardProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("cv-card__header", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return <h3 className={cn("cv-card__title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("cv-card__description", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("cv-card__content", className)} {...props} />;
}
