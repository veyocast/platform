"use client";

import { useRef } from "react";

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

import {
  createTenantTemplate,
  instantiateTenantTemplate
} from "./actions";

type PlaylistOption = { id: string; name: string };

export function TemplateCreateDialog({
  disabled,
  playlists
}: {
  disabled: boolean;
  playlists: PlaylistOption[];
}) {
  const key = useRef<HTMLInputElement>(null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled || playlists.length === 0}>Nieuwe template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Playlist als template opslaan</DialogTitle>
          <DialogDescription>
            VeyoCast legt een veilige momentopname van het concept vast. Releases en schermtoewijzingen gaan niet mee.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={createTenantTemplate}
            className="playlist-form"
            onSubmit={() => ensureIdempotencyKey(key.current)}
          >
            <input name="idempotencyKey" ref={key} type="hidden" />
            <div className="field">
              <label htmlFor="template-source-playlist">Bronplaylist</label>
              <select id="template-source-playlist" name="playlistId" required>
                <option value="">Kies een playlist</option>
                {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="template-name">Templatenaam</label>
              <input id="template-name" maxLength={120} minLength={2} name="name" required type="text" />
            </div>
            <div className="field">
              <label htmlFor="template-description">Beschrijving</label>
              <textarea id="template-description" maxLength={500} name="description" rows={3} />
            </div>
            <DialogFooter><Button type="submit">Template vastleggen</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateUseDialog({
  templateId,
  templateName
}: {
  templateId: string;
  templateName: string;
}) {
  const key = useRef<HTMLInputElement>(null);
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="secondary">Gebruiken</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuw concept uit {templateName}</DialogTitle>
          <DialogDescription>
            Beschikbare media en iteminstellingen worden gekopieerd naar een nieuw, onafhankelijk concept.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            action={instantiateTenantTemplate}
            className="playlist-form"
            onSubmit={() => ensureIdempotencyKey(key.current)}
          >
            <input name="idempotencyKey" ref={key} type="hidden" />
            <input name="templateId" type="hidden" value={templateId} />
            <div className="field">
              <label htmlFor={`template-playlist-name-${templateId}`}>Naam van de nieuwe playlist</label>
              <input defaultValue={`${templateName} · kopie`} id={`template-playlist-name-${templateId}`} maxLength={120} minLength={2} name="name" required type="text" />
            </div>
            <DialogFooter><Button type="submit">Concept maken</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ensureIdempotencyKey(input: HTMLInputElement | null) {
  if (input && !input.value) input.value = crypto.randomUUID();
}
