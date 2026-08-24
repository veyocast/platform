import { redirect } from "next/navigation";

import { verifyMolliePayment } from "../../../../../../lib/billing/verify-mollie-payment";
import { requireTenantControlSession } from "../../../../../../lib/control-session";

export default async function BillingReturnPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const session = await requireTenantControlSession("tenant.billing.read");
  const attemptId = (await searchParams).attempt ?? "";
  if (!session.tenantId || !session.isLive || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(attemptId)) {
    redirect("/dashboard/settings/billing?fout=De%20betaalreferentie%20is%20ongeldig.");
  }
  let result: Awaited<ReturnType<typeof verifyMolliePayment>>;
  try {
    result = await verifyMolliePayment({ attemptId, channel: "return", requestBody: `return:${attemptId}`, tenantId: session.tenantId });
  } catch {
    redirect("/dashboard/settings/billing?fout=De%20providerbevestiging%20is%20nog%20niet%20beschikbaar.%20Probeer%20zo%20opnieuw.");
  }
  if (!result.found) redirect("/dashboard/settings/billing?fout=Deze%20betaalpoging%20hoort%20niet%20bij%20de%20actieve%20vereniging.");
  const message = result.status === "paid"
    ? "Betaalmethode server-side bevestigd."
    : "Mollie verwerkt de betaling nog. De status wordt automatisch bijgewerkt.";
  redirect(`/dashboard/settings/billing?succes=${encodeURIComponent(message)}`);
}
