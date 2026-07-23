"use client";

import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@veyocast/ui";
import { Power, Trash2 } from "lucide-react";

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
  return <Dialog>
    <DialogTrigger asChild>
      <Button disabled={!canManage} type="button" variant="destructive">
        <Power aria-hidden="true" size={17} /> Scherm deactiveren
      </Button>
    </DialogTrigger>
    <DialogContent aria-labelledby={titleId}>
      <DialogHeader>
        <DialogTitle id={titleId}>‘{screenName}’ deactiveren?</DialogTitle>
        <DialogDescription>
          De gekoppelde Player wordt ingetrokken en nieuwe pairing, sync en playback vanaf de server stoppen.
        </DialogDescription>
      </DialogHeader>
      <form action={deactivateScreen} className="playlist-edit-dialog__form">
        <DialogBody>
          <input name="screenId" type="hidden" value={screenId} />
          <p className="notice notice--warning">
            <strong>Offline gevolg.</strong> Een Player zonder internet kan de lokaal gevalideerde release blijven tonen tot de eerstvolgende serververbinding.
          </p>
          <label className="check-row">
            <input disabled={!canManage} name="confirmOffline" required type="checkbox" value="yes" />
            <span><strong>Ik begrijp het offline gevolg</strong><span className="work-panel__meta">De server kan een volledig offline apparaat niet onmiddellijk bereiken.</span></span>
          </label>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Annuleren</Button></DialogClose>
          <Button disabled={!canManage} type="submit" variant="destructive">Ja, deactiveren</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function RemoveDialog({ canManage, screenId, screenName }: Omit<ScreenLifecycleActionsProps, "status">) {
  const titleId = `remove-screen-${screenId}`;
  const descriptionId = `remove-screen-description-${screenId}`;
  return <Dialog>
    <DialogTrigger asChild>
      <Button disabled={!canManage} type="button" variant="destructive">
        <Trash2 aria-hidden="true" size={17} /> Scherm verwijderen
      </Button>
    </DialogTrigger>
    <DialogContent aria-describedby={descriptionId} aria-labelledby={titleId}>
      <DialogHeader>
        <DialogTitle id={titleId}>‘{screenName}’ verwijderen?</DialogTitle>
        <DialogDescription id={descriptionId}>
          Dit scherm verdwijnt uit beheer en zoeken, de huidige contenttoewijzing wordt losgekoppeld en de schermslot komt vrij.
        </DialogDescription>
      </DialogHeader>
      <form action={removeScreen} className="playlist-edit-dialog__form">
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Annuleren</Button></DialogClose>
          <Button disabled={!canManage} type="submit" variant="destructive">Definitief verwijderen</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
