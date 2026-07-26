"use client";

import { useState } from "react";

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

import { requestScreenAutomationTest } from "./automation-actions";
import styles from "./screen-automation.module.css";

export function ScreenAutomationTest({
  canTest,
  screenId
}: {
  canTest: boolean;
  screenId: string;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog onOpenChange={(open) => {
      if (!open) setConfirmed(false);
    }}>
      <DialogTrigger asChild>
        <Button disabled={!canTest} size="sm" variant="secondary">
          Startgedrag testen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Starttest naar Player sturen</DialogTitle>
          <DialogDescription>
            De Player moet online zijn. Zonder pushkanaal ontvangt een gesloten
            of offline app deze opdracht niet.
          </DialogDescription>
        </DialogHeader>
        <form action={requestScreenAutomationTest}>
          <DialogBody>
            <input name="screenId" type="hidden" value={screenId} />
            <div className={styles.disclaimer}>
              <strong>Wat deze test wel en niet bewijst</strong>
              <p>
                VeyoCast controleert of de gekoppelde Player de opdracht ontvangt
                en een lokale startpoging uitvoert. Dat bewijst niet dat de
                televisie uit stand-by komt of beeld toont. Controleer het fysieke
                scherm na de test.
              </p>
            </div>
            <label className={styles.confirmation}>
              <input
                checked={confirmed}
                name="confirmScope"
                onChange={(event) => setConfirmed(event.target.checked)}
                required
                type="checkbox"
                value="yes"
              />
              <span>Ik begrijp dat fysieke TV-status niet op afstand wordt bevestigd.</span>
            </label>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Annuleren</Button>
            </DialogClose>
            <Button disabled={!confirmed} type="submit">Testopdracht sturen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
