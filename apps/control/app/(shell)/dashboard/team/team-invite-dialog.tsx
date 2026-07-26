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

import { inviteTenantMember } from "./actions";

type InviteRole = {
  id: string;
  name: string;
};

export function TeamInviteDialog({
  canManageOwners,
  customRoles
}: {
  canManageOwners: boolean;
  customRoles: InviteRole[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button>Teamlid uitnodigen</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Teamlid uitnodigen</DialogTitle>
          <DialogDescription>
            De persoonlijke link verloopt na zeven dagen en werkt alleen voor het opgegeven e-mailadres.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={inviteTenantMember} className="team-invite-dialog-form">
            <div className="field">
              <label htmlFor="team-email">E-mailadres</label>
              <input autoComplete="email" id="team-email" maxLength={320} name="email" placeholder="vrijwilliger@vereniging.nl" required type="email" />
            </div>
            <div className="field">
              <label htmlFor="team-access">Rol</label>
              <select defaultValue="builtin:tenant_editor" id="team-access" name="access">
                <optgroup label="Standaardrollen">
                  <option value="builtin:tenant_viewer">Kijker</option>
                  <option value="builtin:tenant_editor">Editor</option>
                  <option value="builtin:tenant_admin">Beheerder</option>
                  {canManageOwners ? <option value="builtin:tenant_owner">Eigenaar</option> : null}
                </optgroup>
                {customRoles.length ? (
                  <optgroup label="Custom rollen">
                    {customRoles.map((role) => <option key={role.id} value={`custom:${role.id}`}>{role.name}</option>)}
                  </optgroup>
                ) : null}
              </select>
              <p>Alleen een eigenaar kan een andere eigenaar uitnodigen.</p>
            </div>
            <p className="work-panel__meta">E-mailadres en invitation-token worden nooit in auditmetadata opgenomen.</p>
            <DialogFooter>
              <Button type="submit">Uitnodiging versturen</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
