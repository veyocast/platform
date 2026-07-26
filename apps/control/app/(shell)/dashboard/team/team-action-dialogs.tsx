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

import {
  archiveTenantCustomRole,
  removeTenantMember,
  revokeTenantInvitation
} from "./actions";

export function ArchiveRoleDialog({
  assignedCount,
  revision,
  roleId
}: {
  assignedCount: number;
  revision: number;
  roleId: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button disabled={assignedCount > 0} size="sm" variant="ghost">Archiveren</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Rol archiveren</DialogTitle><DialogDescription>{assignedCount > 0 ? "Wijs eerst alle leden en open uitnodigingen een andere rol toe." : "De rol verdwijnt uit nieuwe toewijzingen."}</DialogDescription></DialogHeader>
        <DialogBody>
          <form action={archiveTenantCustomRole} className="auth-form">
            <input name="expectedRevision" type="hidden" value={revision} />
            <input name="roleId" type="hidden" value={roleId} />
            <label className="check-row"><input name="confirmArchive" required type="checkbox" /><span><strong>Ik wil deze ongebruikte rol archiveren</strong></span></label>
            <DialogFooter><Button type="submit" variant="secondary">Rol archiveren</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMemberDialog({ userId }: { userId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Intrekken</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Toegang intrekken</DialogTitle><DialogDescription>Open sessies verliezen bij de volgende serverrequest hun tenantcontext.</DialogDescription></DialogHeader>
        <DialogBody>
          <form action={removeTenantMember} className="auth-form">
            <input name="userId" type="hidden" value={userId} />
            <label className="check-row"><input name="confirmRemove" required type="checkbox" /><span><strong>Toegang definitief intrekken</strong></span></label>
            <DialogFooter><Button type="submit" variant="secondary">Toegang intrekken</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeInvitationDialog({ invitationId }: { invitationId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="ghost">Intrekken</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Uitnodiging intrekken</DialogTitle><DialogDescription>De persoonlijke uitnodigingslink wordt direct ongeldig.</DialogDescription></DialogHeader>
        <DialogBody>
          <form action={revokeTenantInvitation} className="auth-form">
            <input name="invitationId" type="hidden" value={invitationId} />
            <label className="check-row"><input name="confirmRevoke" required type="checkbox" /><span><strong>Link ongeldig maken</strong></span></label>
            <DialogFooter><Button type="submit" variant="secondary">Uitnodiging intrekken</Button></DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
