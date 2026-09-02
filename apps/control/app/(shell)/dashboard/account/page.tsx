import Link from "next/link";

import { Button, SummaryStrip } from "@veyocast/ui";

import { requireControlSession } from "../../../../lib/control-session";
import { PageHeader, StatusPill } from "../../_components/shell-primitives";

export default async function AccountPage() {
  const session = await requireControlSession();

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="primary">
            <Link href="/dashboard/account/mfa">Tweestapsverificatie beheren</Link>
          </Button>
        }
        description="Beheer je persoonlijke identiteit en beveiliging los van de instellingen van de vereniging."
        eyebrow="Persoonlijk"
        status={{
          label: session.assuranceLevel === "aal2" ? "AAL2 bevestigd" : "AAL2 nodig voor verhoogde acties",
          tone: session.assuranceLevel === "aal2" ? "success" : "warning"
        }}
        title="Account"
      />

      <SummaryStrip
        aria-label="Accountstatus"
        items={[
          { detail: session.email, label: "Naam", value: session.userName },
          { detail: session.tenantRoleLabel ?? "Geen actieve tenantrol", label: "Context", value: session.tenant },
          { detail: "Menselijke sessie", label: "Beveiliging", tone: session.assuranceLevel === "aal2" ? "success" : "warning", value: session.assuranceLevel.toUpperCase() }
        ]}
      />

      <section aria-labelledby="account-security-title" className="data-surface">
        <div className="work-panel__header">
          <div>
            <h2 className="work-panel__title" id="account-security-title">Accountbeveiliging</h2>
            <p className="work-panel__meta">Sessies en MFA horen bij jou; huisstijl, schermen en publicaties horen bij de actieve vereniging.</p>
          </div>
          <StatusPill
            label={session.assuranceLevel === "aal2" ? "Extra beveiligd" : "Standaard sessie"}
            tone={session.assuranceLevel === "aal2" ? "success" : "neutral"}
          />
        </div>
        <div className="settings-security-actions">
          <Button asChild variant="secondary"><Link href="/dashboard/account/mfa">Tweestapsverificatie</Link></Button>
          <Button asChild variant="ghost"><Link href="/context">Van vereniging wisselen</Link></Button>
          <Button asChild variant="ghost"><Link href="/dashboard/settings">Verenigingsinstellingen</Link></Button>
        </div>
      </section>
    </>
  );
}
