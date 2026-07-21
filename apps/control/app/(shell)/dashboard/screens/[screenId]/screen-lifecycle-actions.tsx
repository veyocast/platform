"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Power, Trash2, X } from "lucide-react";

import { deactivateScreen, removeScreen } from "../actions";

type ScreenLifecycleActionsProps = {
  canManage: boolean;
  screenId: string;
  screenName: string;
  status: string;
};

export function ScreenLifecycleActions({
  canManage,
  screenId,
  screenName,
  status
}: ScreenLifecycleActionsProps) {
  return <div className="danger-zone">
    <div>
      <h3>Scherm deactiveren of verwijderen</h3>
      <p>
        Deactiveren trekt de Player in en is herstelbaar. Verwijderen wordt pas
        beschikbaar na deactivatie en haalt het scherm definitief uit het actieve beheer.
      </p>
    </div>
    <div className="page-action-group">
      {status !== "disabled" ? <DeactivateDialog canManage={canManage} screenId={screenId} screenName={screenName} /> : null}
      {status === "disabled" ? <RemoveDialog canManage={canManage} screenId={screenId} screenName={screenName} /> : null}
    </div>
  </div>;
}

function DeactivateDialog({ canManage, screenId, screenName }: Omit<ScreenLifecycleActionsProps, "status">) {
  const titleId = `deactivate-screen-${screenId}`;
  return <Dialog.Root>
    <Dialog.Trigger asChild>
      <button className="button-link button-link--destructive" disabled={!canManage} type="button">
        <Power aria-hidden="true" size={17} /> Scherm deactiveren
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="playlist-edit-dialog__overlay" />
      <Dialog.Content aria-labelledby={titleId} className="playlist-edit-dialog__content">
        <div className="playlist-edit-dialog__header">
          <div>
            <Dialog.Title className="playlist-edit-dialog__title" id={titleId}>‘{screenName}’ deactiveren?</Dialog.Title>
            <Dialog.Description className="work-panel__meta">
              De gekoppelde Player wordt ingetrokken en nieuwe pairing, sync en playback vanaf de server stoppen.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button aria-label="Dialoog sluiten" className="table-action" type="button"><X aria-hidden="true" size={18} /></button>
          </Dialog.Close>
        </div>
        <form action={deactivateScreen} className="playlist-edit-dialog__form">
          <input name="screenId" type="hidden" value={screenId} />
          <p className="notice notice--warning">
            <strong>Offline gevolg.</strong> Een Player zonder internet kan de lokaal gevalideerde release blijven tonen tot de eerstvolgende serververbinding.
          </p>
          <label className="check-row">
            <input disabled={!canManage} name="confirmOffline" required type="checkbox" value="yes" />
            <span><strong>Ik begrijp het offline gevolg</strong><span className="work-panel__meta">De server kan een volledig offline apparaat niet onmiddellijk bereiken.</span></span>
          </label>
          <div className="playlist-edit-dialog__actions">
            <Dialog.Close asChild><button className="button-link button-link--secondary" type="button">Annuleren</button></Dialog.Close>
            <button className="button-link button-link--destructive" disabled={!canManage} type="submit">Ja, deactiveren</button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function RemoveDialog({ canManage, screenId, screenName }: Omit<ScreenLifecycleActionsProps, "status">) {
  const titleId = `remove-screen-${screenId}`;
  const descriptionId = `remove-screen-description-${screenId}`;
  return <Dialog.Root>
    <Dialog.Trigger asChild>
      <button className="button-link button-link--destructive" disabled={!canManage} type="button">
        <Trash2 aria-hidden="true" size={17} /> Scherm verwijderen
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="playlist-edit-dialog__overlay" />
      <Dialog.Content aria-describedby={descriptionId} aria-labelledby={titleId} className="playlist-edit-dialog__content">
        <div className="playlist-edit-dialog__header">
          <div>
            <Dialog.Title className="playlist-edit-dialog__title" id={titleId}>‘{screenName}’ verwijderen?</Dialog.Title>
            <Dialog.Description className="work-panel__meta" id={descriptionId}>
              Dit scherm verdwijnt uit beheer en zoeken, de huidige contenttoewijzing wordt losgekoppeld en de schermslot komt vrij.
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <button aria-label="Dialoog sluiten" className="table-action" type="button"><X aria-hidden="true" size={18} /></button>
          </Dialog.Close>
        </div>
        <form action={removeScreen} className="playlist-edit-dialog__form">
          <input name="screenId" type="hidden" value={screenId} />
          <p className="notice notice--critical">
            <strong>Niet herstelbaar vanuit Control.</strong> Releasehistorie, devicehistorie en auditbewijs blijven om veiligheidsredenen bewaard.
          </p>
          <div className="field">
            <label htmlFor={`remove-screen-name-${screenId}`}>Typ <strong>{screenName}</strong> ter bevestiging</label>
            <input
              autoComplete="off"
              disabled={!canManage}
              id={`remove-screen-name-${screenId}`}
              maxLength={120}
              name="confirmationName"
              required
              type="text"
            />
          </div>
          <div className="playlist-edit-dialog__actions">
            <Dialog.Close asChild><button className="button-link button-link--secondary" type="button">Annuleren</button></Dialog.Close>
            <button className="button-link button-link--destructive" disabled={!canManage} type="submit">Definitief verwijderen</button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
