import { redirect } from "next/navigation";

export default function AccountMfaPage() {
  redirect("/auth/mfa?reden=account&terug=%2Fdashboard%2Faccount");
}
