import { Button, PageHeader, StatusPill } from "@veyocast/ui";
import Link from "next/link";

import { requireControlCapability } from "../../../../../lib/control-session";
import { loadPlatformSupport } from "../../../dashboard/support/data";
import { assignPlatformSupportRole, createPlatformSupportRole, createSupportDepartment } from "../actions";
import { relationName } from "../../../dashboard/support/page";
import styles from "../../../dashboard/support/support.module.css";

export default async function SupportSettingsPage() {
  await requireControlCapability("platform.ticket.admin", {
    aal2: true,
    returnTo: "/platform/support/settings"
  });
  const data = await loadPlatformSupport();
  return (
    <>
      <PageHeader
        actions={<Link className="button-link button-link--secondary" href="/platform/support">Terug naar inbox</Link>}
        description="Maak begrensde werkrollen en routeer afdelingen zonder platformbrede beheerdersrechten uit te delen."
        eyebrow="Platform · Supportdesk"
        title="Afdelingen en werkrollen"
      />
      <div className={styles.layout}>
        <section className="workspace-section">
          <div className="workspace-section__header"><div><h2 className="workspace-section__title">Werkrollen</h2><p className="work-panel__meta">Rechten gelden alleen binnen de supportdesk.</p></div><StatusPill label={`${data.roles.length} rollen`} tone="neutral" /></div>
          {data.roles.map((role) => <article className="work-panel" key={role.id}><strong>{role.name}</strong><p className="work-panel__meta">{role.description}</p><p className="work-panel__meta">{role.capabilities.join(" · ")}</p></article>)}
          <form action={createPlatformSupportRole} className={styles.form}>
            <label><span>Naam</span><input maxLength={80} name="name" required /></label>
            <label><span>Beschrijving</span><input maxLength={500} name="description" /></label>
            <fieldset className={styles.wide}><legend>Rechten</legend>{[
              ["platform.ticket.read", "Tickets bekijken"],
              ["platform.ticket.write", "Antwoorden en toewijzen"],
              ["platform.ticket.sensitive", "Gevoelige inhoud"],
              ["platform.ticket.admin", "Afdelingen en verwijdering"]
            ].map(([value, label]) => <label className={styles.checkbox} key={value}><input name="capabilities" type="checkbox" value={value} /> {label}</label>)}</fieldset>
            <Button type="submit">Werkrol maken</Button>
          </form>
        </section>
        <section className="workspace-section">
          <div className="workspace-section__header"><div><h2 className="workspace-section__title">Afdelingen</h2><p className="work-panel__meta">Actieve keuzes in het klantformulier.</p></div><StatusPill label={`${data.departments.length} afdelingen`} tone="neutral" /></div>
          {data.departments.map((department) => <article className="work-panel" key={department.id}><strong>{department.name}</strong><p className="work-panel__meta">{department.description}</p></article>)}
          <form action={createSupportDepartment} className={styles.form}>
            <label><span>Naam</span><input maxLength={80} name="name" required /></label>
            <label><span>Beschrijving</span><input maxLength={500} name="description" /></label>
            <fieldset className={styles.wide}><legend>Routeer naar werkrollen</legend>{data.roles.map((role) => <label className={styles.checkbox} key={role.id}><input name="roleIds" type="checkbox" value={role.id} /> {role.name}</label>)}</fieldset>
            <Button type="submit">Afdeling toevoegen</Button>
          </form>
        </section>
      </div>
      <section className="workspace-section">
        <div className="workspace-section__header"><div><h2 className="workspace-section__title">Medewerkers toewijzen</h2><p className="work-panel__meta">Een platformmedewerker heeft maximaal één supportwerkrol; de gewone platformrol blijft ongewijzigd.</p></div></div>
        <form action={assignPlatformSupportRole} className={styles.form}>
          <label><span>Platformmedewerker</span><select name="userId" required>{data.platformUsers.map((membership) => <option key={membership.user_id} value={membership.user_id}>{relationName(membership.profiles)}</option>)}</select></label>
          <label><span>Werkrol</span><select name="roleId" required>{data.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
          <Button disabled={!data.platformUsers.length || !data.roles.length} type="submit">Werkrol toewijzen</Button>
        </form>
      </section>
    </>
  );
}
