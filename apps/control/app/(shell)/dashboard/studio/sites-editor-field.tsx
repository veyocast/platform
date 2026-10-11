"use client";
import {cloneElement,isValidElement,type ReactElement,type ReactNode} from "react";
import {Field,type FieldProps,type FieldControlProps} from "@veyocast/ui";
/** Connect the literal editor's single control to the canonical Field label and help text. */
export function SitesEditorField({children,...props}:Omit<FieldProps,"children">&{children:ReactNode}){return <Field {...props}>{({controlProps})=>isValidElement(children)?cloneElement(children as ReactElement<FieldControlProps>,controlProps):children}</Field>;}
