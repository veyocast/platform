import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useId } from "react";

import { cn } from "../utils";

export type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: "true";
  id: string;
};

export type FieldRenderProps = {
  controlProps: FieldControlProps;
  id: string;
};

export type FieldProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode | ((props: FieldRenderProps) => ReactNode);
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  label: ReactNode;
};

export function Field({
  children,
  className,
  description,
  error,
  id,
  label,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  const controlProps: FieldControlProps = {
    "aria-describedby": describedBy,
    "aria-invalid": error ? "true" : undefined,
    id: controlId
  };

  return (
    <div className={cn("cv-field", className)} {...props}>
      <label className="cv-field__label" htmlFor={controlId}>
        {label}
      </label>
      {description ? (
        <div className="cv-field__description" id={descriptionId}>
          {description}
        </div>
      ) : null}
      {typeof children === "function" ? children({ controlProps, id: controlId }) : children}
      {error ? (
        <div className="cv-field__error" id={errorId}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

export function TextInput({ className, type = "text", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("cv-field-control", className)} type={type} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("cv-field-control", "cv-textarea", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn("cv-field-control", className)} {...props} />;
}

export type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return <input className={cn("cv-checkbox", className)} type="checkbox" {...props} />;
}

export type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "role" | "type">;

export function Switch({ className, ...props }: SwitchProps) {
  return <input className={cn("cv-switch", className)} role="switch" type="checkbox" {...props} />;
}
