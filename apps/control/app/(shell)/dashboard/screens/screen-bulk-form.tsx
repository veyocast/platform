"use client";

import {
  useState,
  type ChangeEvent,
  type ReactNode
} from "react";

import { BulkActionBar, Button } from "@veyocast/ui";

export function ScreenBulkForm({
  addToGroupAction,
  assignReleaseAction,
  canPublish,
  children,
  groups,
  idempotencyKey,
  releases,
  syncAction
}: {
  addToGroupAction: (formData: FormData) => void | Promise<void>;
  assignReleaseAction: (formData: FormData) => void | Promise<void>;
  canPublish: boolean;
  children: ReactNode;
  groups: Array<{ id: string; name: string }>;
  idempotencyKey: string;
  releases: Array<{ id: string; label: string }>;
  syncAction: (formData: FormData) => void | Promise<void>;
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
    <form onChange={updateSelection}>
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {children}
      {selectedCount > 0 ? (
        <BulkActionBar
          actions={(
            <>
              {groups.length ? (
                <label className="bulk-action-field">
                  <span>Schermgroep</span>
                  <select name="groupId">
                    <option value="">Kies een groep</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <Button formAction={addToGroupAction} type="submit" variant="secondary">
                    Aan groep toevoegen
                  </Button>
                </label>
              ) : null}
              {canPublish && releases.length ? (
                <div className="bulk-release-assignment">
                  <label className="bulk-action-field">
                    <span>Immutable release</span>
                    <select name="releaseId">
                      <option value="">Kies een release</option>
                      {releases.map((release) => (
                        <option key={release.id} value={release.id}>{release.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="bulk-confirm">
                    <input name="confirmReleaseAssignment" type="checkbox" value="yes" />
                    <span>Toewijzing bevestigen</span>
                  </label>
                  <Button formAction={assignReleaseAction} type="submit">
                    Release toewijzen
                  </Button>
                </div>
              ) : null}
              <Button formAction={syncAction} type="submit" variant="secondary">
                Synchronisatie opnieuw proberen
              </Button>
            </>
          )}
          description="Actieve schermen zijn selecteerbaar. Sync en release-uitrol controleren gekoppelde Players opnieuw op de server."
          title={`${selectedCount} ${selectedCount === 1 ? "scherm geselecteerd" : "schermen geselecteerd"}`}
        />
      ) : null}
    </form>
  );
}
