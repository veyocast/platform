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
  createTenantCustomRole,
  updateTenantCustomRole
} from "./actions";

export type CustomRoleView = {
  capabilities: string[];
  description: string | null;
  id: string;
  name: string;
  revision: number;
  status: string;
};

export function CustomRoleDialog({ role }: { role?: CustomRoleView }) {
  const editing = Boolean(role);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={editing ? "sm" : "md"} variant={editing ? "ghost" : "secondary"}>
          {editing ? "Bewerken" : "Nieuwe custom rol"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `${role!.name} bewerken` : "Custom rol maken"}</DialogTitle>
          <DialogDescription>
            Alle teamleden kunnen tenantinhoud bekijken. Kies hier welke werkacties deze rol
            daarnaast mag uitvoeren. Eigenaarschap en rollenbeheer blijven beschermd.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form action={editing ? updateTenantCustomRole : createTenantCustomRole} className="playlist-form">
            {role ? (
              <>
                <input name="expectedRevision" type="hidden" value={role.revision} />
                <input name="roleId" type="hidden" value={role.id} />
              </>
            ) : null}
            <div className="form-grid">
              <div className="field">
                <label htmlFor={`custom-role-name-${role?.id ?? "new"}`}>Rolnaam</label>
                <input
                  defaultValue={role?.name ?? ""}
                  id={`custom-role-name-${role?.id ?? "new"}`}
                  maxLength={60}
                  minLength={2}
                  name="name"
                  placeholder="Bijvoorbeeld Contentcoördinator"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor={`custom-role-description-${role?.id ?? "new"}`}>Beschrijving</label>
                <input
                  defaultValue={role?.description ?? ""}
                  id={`custom-role-description-${role?.id ?? "new"}`}
                  maxLength={240}
                  name="description"
                  placeholder="Korte uitleg voor beheerders"
                />
              </div>
            </div>
            <fieldset className="permission-grid">
              <legend>Werkrechten</legend>
              {permissionOptions.map((permission) => (
                <label className="permission-option" key={permission.value}>
                  <input
                    defaultChecked={permission.checked(role?.capabilities ?? [])}
                    name="capabilities"
                    type="checkbox"
                    value={permission.value}
                  />
                  <span>
                    <strong>{permission.label}</strong>
                    <small>{permission.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="notice notice--info" role="note">
              Content bewerken omvat media én playlistconcepten. Zo blijven upload, bronmedia en
              playlistinhoud één veilig autorisatiedomein.
            </p>
            <DialogFooter>
              <Button type="submit">{editing ? "Rol bijwerken" : "Rol maken"}</Button>
            </DialogFooter>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

const permissionOptions = [
  {
    checked: (values: string[]) =>
      values.includes("tenant.media.write") && values.includes("tenant.playlist.write"),
    description: "Upload en beheer media; maak, wijzig en archiveer playlistconcepten.",
    label: "Content bewerken",
    value: "content.write"
  },
  {
    checked: (values: string[]) => values.includes("tenant.playlist.publish"),
    description: "Publiceer releases en wijzig actieve schermtoewijzingen.",
    label: "Publiceren",
    value: "tenant.playlist.publish"
  },
  {
    checked: (values: string[]) => values.includes("tenant.screen.manage"),
    description: "Koppel, configureer, deactiveer en herstel schermen.",
    label: "Schermen beheren",
    value: "tenant.screen.manage"
  },
  {
    checked: (values: string[]) => values.includes("tenant.settings.manage"),
    description: "Wijzig tenantnaam, playerstandaarden en publicatievoorkeuren.",
    label: "Instellingen beheren",
    value: "tenant.settings.manage"
  },
  {
    checked: (values: string[]) => values.includes("tenant.audit.read"),
    description: "Bekijk de volledige tenantactiviteit, niet alleen eigen acties.",
    label: "Activiteit bekijken",
    value: "tenant.audit.read"
  },
  {
    checked: (values: string[]) => values.includes("tenant.support.export"),
    description: "Maak een privacyveilige supportbundel voor probleemonderzoek.",
    label: "Supportbundel exporteren",
    value: "tenant.support.export"
  }
] as const;
