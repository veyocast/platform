"use client";

import { useState } from "react";

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

import { createPlaylist, duplicatePlaylist } from "./actions";

type PlaylistSource = {
  id: string;
  name: string;
};

type CreationMode = "blank" | "duplicate" | "template";

const templateOptions = [
  {
    description: "Een rustige basis voor een doorlopende contentloop.",
    name: "Doorlopende presentatie",
    value: "loop"
  },
  {
    description: "Een basisconcept om content per dagdeel op te bouwen.",
    name: "Dagprogramma",
    value: "day-program"
  }
] as const;

export function PlaylistCreateDialog({
  canWrite,
  sources
}: {
  canWrite: boolean;
  sources: PlaylistSource[];
}) {
  const [mode, setMode] = useState<CreationMode>("blank");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canWrite}>Nieuwe playlist</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="playlist-create-description">
        <DialogHeader>
          <DialogTitle>Nieuwe playlist</DialogTitle>
          <DialogDescription id="playlist-create-description">
            Begin leeg, maak een veilige conceptkopie of kies een eenvoudig basisconcept.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div aria-label="Manier van maken" className="segmented-control" role="tablist">
            <ModeButton active={mode === "blank"} onSelect={() => setMode("blank")}>
              Leeg
            </ModeButton>
            <ModeButton active={mode === "duplicate"} onSelect={() => setMode("duplicate")}>
              Dupliceren
            </ModeButton>
            <ModeButton active={mode === "template"} onSelect={() => setMode("template")}>
              Template
            </ModeButton>
          </div>

          {mode === "duplicate" ? (
            <form action={duplicatePlaylist} className="playlist-form">
              <div className="field">
                <label htmlFor="duplicate-source-playlist">Bronplaylist</label>
                <select
                  disabled={!canWrite || sources.length === 0}
                  id="duplicate-source-playlist"
                  name="sourcePlaylistId"
                  required
                >
                  <option value="">Kies een playlist</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>{source.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="duplicate-playlist-name">Naam van de kopie</label>
                <input
                  disabled={!canWrite}
                  id="duplicate-playlist-name"
                  maxLength={120}
                  minLength={2}
                  name="name"
                  placeholder="Leeg laten voor ‘Kopie van …’"
                  type="text"
                />
              </div>
              <p className="work-panel__meta">
                Items en iteminstellingen gaan mee. Releases, historie en schermtoewijzingen niet.
              </p>
              <DialogFooter>
                <Button disabled={!canWrite || sources.length === 0} type="submit">
                  Concept dupliceren
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form action={createPlaylist} className="playlist-form">
              {mode === "template" ? (
                <div className="field">
                  <label htmlFor="playlist-template">Basisconcept</label>
                  <select
                    disabled={!canWrite}
                    id="playlist-template"
                    name="template"
                    onChange={(event) => {
                      const template = templateOptions.find(({ value }) => value === event.currentTarget.value);
                      const form = event.currentTarget.form;
                      if (!template || !form) return;
                      const name = form.elements.namedItem("name");
                      const description = form.elements.namedItem("description");
                      if (name instanceof HTMLInputElement) name.value = template.name;
                      if (description instanceof HTMLTextAreaElement) description.value = template.description;
                    }}
                    required
                  >
                    <option value="">Kies een basisconcept</option>
                    {templateOptions.map((template) => (
                      <option key={template.value} value={template.value}>{template.name}</option>
                    ))}
                  </select>
                  <p className="work-panel__meta">
                    Basisconcepten zetten alleen veilige conceptgegevens klaar; media voeg je bewust zelf toe.
                  </p>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor={`new-playlist-name-${mode}`}>Playlistnaam</label>
                <input
                  disabled={!canWrite}
                  id={`new-playlist-name-${mode}`}
                  maxLength={120}
                  minLength={2}
                  name="name"
                  placeholder="Bijvoorbeeld kantineprogramma"
                  required
                  type="text"
                />
              </div>
              <div className="field">
                <label htmlFor={`new-playlist-description-${mode}`}>Beschrijving</label>
                <textarea
                  disabled={!canWrite}
                  id={`new-playlist-description-${mode}`}
                  maxLength={500}
                  name="description"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button disabled={!canWrite} type="submit">
                  Concept maken
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  children,
  onSelect
}: {
  active: boolean;
  children: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className="segmented-control__item"
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}
