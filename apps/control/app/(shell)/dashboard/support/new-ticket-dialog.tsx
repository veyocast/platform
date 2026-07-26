"use client";

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

import { createSupportTicket } from "./actions";
import styles from "./support.module.css";

type Department = {
  description: string | null;
  id: string;
  name: string;
};

export function NewTicketDialog({ departments }: { departments: Department[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!departments.length}>Nieuw ticket</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuw supportticket</DialogTitle>
          <DialogDescription>
            Kies de juiste afdeling en beschrijf wat je verwachtte, wat er gebeurde en wat de impact is.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={createSupportTicket} className={styles.form}>
            <label><span>Afdeling</span><select name="departmentId" required>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label><span>Prioriteit</span><select defaultValue="normal" name="priority"><option value="low">Laag</option><option value="normal">Normaal</option><option value="high">Hoog</option><option value="urgent">Urgent</option></select></label>
            <label className={styles.wide}><span>Onderwerp</span><input maxLength={160} name="subject" required /></label>
            <label className={styles.wide}><span>Bericht</span><textarea maxLength={10000} name="body" required rows={7} /></label>
            <label className={styles.checkbox}><input name="sensitive" type="checkbox" /> Bevat gevoelige inhoud; beperk inzage</label>
            <DialogFooter className={styles.wide}>
              <Button type="submit">Ticket versturen</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
