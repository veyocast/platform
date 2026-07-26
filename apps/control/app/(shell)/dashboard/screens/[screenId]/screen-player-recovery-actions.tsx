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
import { RefreshCw, RotateCcw, Unplug } from "lucide-react";

import { queuePlayerRecoveryCommand } from "../actions";

type ScreenPlayerRecoveryActionsProps = {
  canManage: boolean;
  screenId: string;
  screenName: string;
};

export function ScreenPlayerRecoveryActions({
  canManage,
  screenId,
  screenName
}: ScreenPlayerRecoveryActionsProps) {
  return (
    <section className="workspace-section" aria-labelledby="player-more-actions-title">
      <div className="workspace-section__header">
        <div>
          <h2 className="workspace-section__title" id="player-more-actions-title">
            Meer acties
          </h2>
          <p className="work-panel__meta">
            Eenmalige opdrachten worden bij de eerstvolgende installatiepoll
            afgeleverd en verlopen automatisch.
          </p>
        </div>
      </div>
      <div className="page-action-group">
        <RecoverPairingDialog
          canManage={canManage}
          screenId={screenId}
          screenName={screenName}
        />
        <ForceUnpairDialog
          canManage={canManage}
          screenId={screenId}
          screenName={screenName}
        />
        <ReloadPlayerDialog
          canManage={canManage}
          screenId={screenId}
          screenName={screenName}
        />
      </div>
    </section>
  );
}

function RecoverPairingDialog({
  canManage,
  screenId,
  screenName
}: ScreenPlayerRecoveryActionsProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canManage} type="button" variant="secondary">
          <RotateCcw aria-hidden="true" size={17} /> Koppeling herstellen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koppeling van ‘{screenName}’ herstellen?</DialogTitle>
          <DialogDescription>
            De installatie haalt een nieuwe schermcredential op zonder de
            beheerde schermcontext te vervangen.
          </DialogDescription>
        </DialogHeader>
        <form action={queuePlayerRecoveryCommand}>
          <DialogBody>
            <CommandFields
              commandType="RECOVER_PAIRING"
              screenId={screenId}
            />
            <p className="notice notice--success">
              <strong>Blijft behouden:</strong> scherm, tenant, playlist,
              planning, releasehistorie en installatie-ID.
            </p>
            <p className="notice notice--warning">
              <strong>Wordt vervangen:</strong> alleen de kapotte of ingetrokken
              schermcredential zodra de Player de opdracht uitvoert.
            </p>
            <label className="check-row">
              <input
                disabled={!canManage}
                name="confirmPreserve"
                required
                type="checkbox"
                value="yes"
              />
              <span>Herstel met behoud van schermconfiguratie</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Annuleren</Button>
            </DialogClose>
            <Button disabled={!canManage} type="submit" variant="primary">
              Herstelopdracht sturen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ForceUnpairDialog({
  canManage,
  screenId,
  screenName
}: ScreenPlayerRecoveryActionsProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canManage} type="button" variant="secondary">
          <Unplug aria-hidden="true" size={17} /> Ontkoppelen en nieuwe code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>‘{screenName}’ ontkoppelen?</DialogTitle>
          <DialogDescription>
            De fysieke Player gaat terug naar pairing en maakt automatisch een
            nieuwe tijdelijke code.
          </DialogDescription>
        </DialogHeader>
        <form action={queuePlayerRecoveryCommand}>
          <DialogBody>
            <CommandFields commandType="FORCE_UNPAIR" screenId={screenId} />
            <p className="notice notice--success">
              <strong>Blijft behouden:</strong> schermobject, tenant, playlist,
              planning en historische statistieken.
            </p>
            <p className="notice notice--critical">
              <strong>Wordt verwijderd:</strong> de actieve schermbinding en
              schermcredential. De installatie-ID blijft bestaan.
            </p>
            <label className="check-row">
              <input
                disabled={!canManage}
                name="confirmUnpair"
                required
                type="checkbox"
                value="yes"
              />
              <span>Ik begrijp dat de Player opnieuw gekoppeld moet worden</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Annuleren</Button>
            </DialogClose>
            <Button disabled={!canManage} type="submit" variant="destructive">
              Ontkoppelen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReloadPlayerDialog({
  canManage,
  screenId,
  screenName
}: ScreenPlayerRecoveryActionsProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!canManage} type="button" variant="secondary">
          <RefreshCw aria-hidden="true" size={17} /> Player opnieuw laden
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Player van ‘{screenName}’ opnieuw laden?</DialogTitle>
          <DialogDescription>
            Alleen de Playerpagina herlaadt. Koppeling, installatie-ID, cache en
            schermconfiguratie blijven ongewijzigd.
          </DialogDescription>
        </DialogHeader>
        <form action={queuePlayerRecoveryCommand}>
          <DialogBody>
            <CommandFields commandType="RELOAD_PLAYER" screenId={screenId} />
            <p className="notice">
              De opdracht verloopt na vijf minuten wanneer de Player niet
              bereikbaar is.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Annuleren</Button>
            </DialogClose>
            <Button disabled={!canManage} type="submit" variant="primary">
              Opnieuw laden
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommandFields({
  commandType,
  screenId
}: {
  commandType: string;
  screenId: string;
}) {
  return (
    <>
      <input name="commandType" type="hidden" value={commandType} />
      <input name="screenId" type="hidden" value={screenId} />
    </>
  );
}
