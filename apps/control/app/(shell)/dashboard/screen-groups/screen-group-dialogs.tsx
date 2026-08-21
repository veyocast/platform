"use client";

import { useRef } from "react";
import { Archive, Pencil, UsersRound } from "lucide-react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";

import type { ScreenGroupListItem } from "./screen-group-types";
import {
  archiveScreenGroup,
  createScreenGroup,
  updateScreenGroup
} from "./actions";
import styles from "./screen-groups.module.css";

type ScreenOption = {
  disabled: boolean;
  id: string;
  name: string;
  status: string;
};

type ReleaseOption = { id: string; label: string };

export function ScreenGroupDialog({
  disabled,
  group,
  releases,
  screens
}: {
  disabled: boolean;
  group?: ScreenGroupListItem;
  releases: ReleaseOption[];
  screens: ScreenOption[];
}) {
  const idempotencyKey = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(group);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} size={isEditing ? "sm" : "md"} variant={isEditing ? "secondary" : "primary"}>
          {isEditing ? <Pencil aria-hidden="true" /> : <UsersRound aria-hidden="true" />}
          {isEditing ? "Bewerken" : "Nieuwe schermgroep"}
        </Button>
      </DialogTrigger>
      <DialogContent className={styles.dialog}>
        <DialogHeader>
          <DialogTitle>{isEditing ? `${group?.name} bewerken` : "Nieuwe schermgroep"}</DialogTitle>
          <DialogDescription>
            Naam, standaardcontent en schermleden worden in één beveiligde wijziging opgeslagen.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={isEditing ? updateScreenGroup : createScreenGroup}
            className={styles.form}
            onSubmit={() => ensureIdempotencyKey(idempotencyKey.current)}
          >
            <input name="idempotencyKey" ref={idempotencyKey} type="hidden" />
            {group ? (
              <>
                <input name="groupId" type="hidden" value={group.id} />
                <input name="expectedRevision" type="hidden" value={group.revision} />
              </>
            ) : null}
            <div className="field">
              <label htmlFor={`screen-group-name-${group?.id ?? "new"}`}>Naam</label>
              <input
                defaultValue={group?.name}
                id={`screen-group-name-${group?.id ?? "new"}`}
                maxLength={120}
                minLength={2}
                name="name"
                required
                type="text"
              />
            </div>
            <div className="field">
              <label htmlFor={`screen-group-description-${group?.id ?? "new"}`}>Beschrijving</label>
              <textarea
                defaultValue={group?.description ?? ""}
                id={`screen-group-description-${group?.id ?? "new"}`}
                maxLength={500}
                name="description"
                rows={3}
              />
            </div>
            <div className="field">
              <label htmlFor={`screen-group-release-${group?.id ?? "new"}`}>Standaardcontent</label>
              <select
                defaultValue={group?.defaultPlaylistId ?? ""}
                id={`screen-group-release-${group?.id ?? "new"}`}
                name="defaultPlaylistId"
              >
                <option value="">Geen standaardcontent</option>
                {releases.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.label}</option>)}
              </select>
              <small>Bij opslaan wordt de actuele immutable publicatie van deze playlist vastgelegd.</small>
            </div>
            <fieldset className={styles.screenPicker}>
              <legend>Schermen</legend>
              <p>Een scherm mag veilig in meerdere groepen voorkomen.</p>
              <div className={styles.screenOptions}>
                {screens.map((screen) => (
                  <label data-disabled={screen.disabled} key={screen.id}>
                    <input
                      defaultChecked={group?.memberIds.includes(screen.id)}
                      disabled={screen.disabled}
                      name="screenIds"
                      type="checkbox"
                      value={screen.id}
                    />
                    <span><strong>{screen.name}</strong><small>{screenStatus(screen.status)}</small></span>
                  </label>
                ))}
              </div>
              {!screens.length ? <p>Er zijn nog geen schermen beschikbaar.</p> : null}
            </fieldset>
            <DialogFooter>
              <Button type="submit">{isEditing ? "Wijzigingen opslaan" : "Schermgroep maken"}</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveScreenGroupDialog({
  group
}: {
  group: ScreenGroupListItem;
}) {
  const idempotencyKey = useRef<HTMLInputElement>(null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Archive aria-hidden="true" />Archiveren</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group.name} archiveren</DialogTitle>
          <DialogDescription>
            De groep verdwijnt uit nieuwe keuzes. Historische releases en snapshots blijven onveranderlijk.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={archiveScreenGroup} onSubmit={() => ensureIdempotencyKey(idempotencyKey.current)}>
            <input name="groupId" type="hidden" value={group.id} />
            <input name="expectedRevision" type="hidden" value={group.revision} />
            <input name="idempotencyKey" ref={idempotencyKey} type="hidden" />
            <p className={styles.impact}>
              Actieve planningen blokkeren deze actie. Schakel ze eerst uit zodat er geen onbedoelde contentwijziging ontstaat.
            </p>
            <DialogFooter>
              <Button type="submit" variant="destructive">Schermgroep archiveren</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ensureIdempotencyKey(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = crypto.randomUUID();
}

function screenStatus(value: string) {
  if (value === "active") return "Actief";
  if (value === "maintenance") return "Onderhoud";
  if (value === "disabled") return "Uitgeschakeld";
  return value;
}
