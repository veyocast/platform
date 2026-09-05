"use client";

import { useEffect, useRef, useState } from "react";

import type {
  EditorialThemeConfig,
  ThemeSelection
} from "@veyocast/contracts";

import { EditorialThemeEditor } from "../slides/new/editorial-theme-editor";

export function TenantThemeEditor({
  defaults,
  disabled,
  initialSelection,
  initialTheme
}: {
  defaults: EditorialThemeConfig;
  disabled: boolean;
  initialSelection: ThemeSelection;
  initialTheme: EditorialThemeConfig;
}) {
  const [selection, setSelection] = useState(initialSelection);
  const [theme, setTheme] = useState(initialTheme);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    editorRef.current?.closest("form")?.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }, [selection, theme]);

  return (
    <div ref={editorRef}>
      <EditorialThemeEditor
        defaults={defaults}
        disabled={disabled}
        onChange={setTheme}
        onSelectionChange={setSelection}
        selection={selection}
        theme={theme}
      />
    </div>
  );
}
