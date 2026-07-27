"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Archive,
  Copy,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2
} from "lucide-react";

import { Button, buttonVariants } from "@veyocast/ui";

import { FloatingPanel } from "../../_components/floating-panel";
import { mutateStudioProjectAction } from "./actions";
import type { StudioProjectSummary } from "./types";
import styles from "./studio.module.css";

export function ProjectActions({
  canArchive,
  canEdit,
  canMutate,
  project
}: {
  canArchive: boolean;
  canEdit: boolean;
  canMutate: boolean;
  project: StudioProjectSummary;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [pending, startTransition] = useTransition();

  function run(
    operation: "archive" | "delete" | "duplicate" | "rename" | "restore"
  ) {
    setMessage(null);
    startTransition(async () => {
      const result = await mutateStudioProjectAction({
        expectedRevision: project.projectRevision,
        idempotencyKey: crypto.randomUUID(),
        operation,
        payload: operation === "rename" ? { name } : undefined,
        projectId: project.id
      });
      if (!result.ok) {
        setMessage(result.error ?? "De actie is niet uitgevoerd.");
        return;
      }
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <div className={styles.projectActions}>
      <Button asChild size="sm" variant="secondary">
        <Link href={`/dashboard/studio/${project.id}`}>
          {canEdit ? "Bewerken" : "Bekijken"}
        </Link>
      </Button>
      {canMutate ? (
        <FloatingPanel
          className={styles.actionMenu}
          contentClassName={styles.actionPopover}
          contentLabel={`Acties voor ${project.name}`}
          onOpenChange={setOpen}
          open={open}
          trigger={<MoreHorizontal aria-hidden="true" />}
          triggerAriaLabel={`Acties voor ${project.name}`}
          triggerClassName={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <>
            {canEdit ? (
              <>
                <button
                  disabled={pending}
                  onClick={() => setRenaming((value) => !value)}
                  type="button"
                >
                  <Pencil aria-hidden="true" />
                  Hernoemen
                </button>
                {renaming ? (
                  <form
                    className={styles.renameForm}
                    onSubmit={(event) => {
                      event.preventDefault();
                      run("rename");
                    }}
                  >
                    <label>
                      <span className="sr-only">Nieuwe ontwerpnaam</span>
                      <input
                        maxLength={120}
                        minLength={2}
                        onChange={(event) => setName(event.target.value)}
                        required
                        value={name}
                      />
                    </label>
                    <Button disabled={pending} size="sm" type="submit">
                      Opslaan
                    </Button>
                  </form>
                ) : null}
                <button
                  disabled={pending}
                  onClick={() => run("duplicate")}
                  type="button"
                >
                  <Copy aria-hidden="true" />
                  Dupliceren
                </button>
              </>
            ) : null}
            {canArchive && project.status === "active" ? (
              <button
                disabled={pending}
                onClick={() => run("archive")}
                type="button"
              >
                <Archive aria-hidden="true" />
                Archiveren
              </button>
            ) : null}
            {canArchive &&
            (project.status === "archived" || project.status === "deleted") ? (
              <button
                disabled={pending}
                onClick={() => run("restore")}
                type="button"
              >
                <RotateCcw aria-hidden="true" />
                Herstellen
              </button>
            ) : null}
            {canArchive ? (
              <button
                className={styles.destructiveMenuItem}
                disabled={pending}
                onClick={() => {
                  if (
                    window.confirm(
                      `"${project.name}" verwijderen? Je kunt het volgens het bewaarbeleid nog herstellen.`
                    )
                  ) {
                    run("delete");
                  }
                }}
                type="button"
              >
                <Trash2 aria-hidden="true" />
                Verwijderen
              </button>
            ) : null}
            {message ? <p role="alert">{message}</p> : null}
          </>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
