"use client";

import {
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";

import { BulkActionBar, Button } from "@veyocast/ui";

export function ScreenBulkForm({
  action,
  children,
  idempotencyKey
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  idempotencyKey: string;
}) {
  const [selectedCount, setSelectedCount] = useState(0);

  function updateSelection(event: ChangeEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }
    const form = event.currentTarget;
    const selections = Array.from(
      form.querySelectorAll<HTMLInputElement>("input[data-screen-select]")
    );
    if (target.hasAttribute("data-select-all")) {
      for (const checkbox of selections) {
        if (!checkbox.disabled) checkbox.checked = target.checked;
      }
    }
    setSelectedCount(
      selections.filter((checkbox) => checkbox.checked && !checkbox.disabled)
        .length
    );
  }

  return (
    <form action={action} onChange={updateSelection}>
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {children}
      {selectedCount > 0 ? (
        <BulkActionBar
          actions={(
            <Button type="submit">
              Synchronisatie opnieuw proberen
            </Button>
          )}
          description="Alleen actieve schermen met een gekoppelde Player zijn selecteerbaar."
          title={`${selectedCount} ${selectedCount === 1 ? "scherm geselecteerd" : "schermen geselecteerd"}`}
        />
      ) : null}
    </form>
  );
}
