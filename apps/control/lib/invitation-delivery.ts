export type InvitationDeliveryError = Readonly<{
  code?: string | null;
  status?: number | null;
}>;

export function classifyInvitationDeliveryError(
  error: InvitationDeliveryError
) {
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "invite_rate_limited";
  }

  if (error.code === "email_address_not_authorized") {
    return "invite_smtp_not_configured";
  }

  if (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    error.code === "identity_already_exists"
  ) {
    return "invite_existing_account";
  }

  if (
    error.code === "email_provider_disabled" ||
    error.code === "provider_disabled"
  ) {
    return "invite_email_provider_disabled";
  }

  if (
    error.code === "hook_timeout" ||
    error.code === "hook_timeout_after_retry" ||
    error.code === "request_timeout"
  ) {
    return "invite_provider_unavailable";
  }

  return "invite_delivery_failed";
}

export function invitationDeliveryLabel(
  status: string,
  errorCode?: string | null
) {
  if (status === "sent") return "Verstuurd";
  if (status !== "failed") return "Nog niet verstuurd";

  switch (errorCode) {
    case "invite_smtp_not_configured":
      return "SMTP niet ingericht";
    case "invite_rate_limited":
      return "Verzendlimiet bereikt";
    case "invite_existing_account":
      return "Account bestaat al";
    case "invite_email_provider_disabled":
      return "E-mailprovider uitgeschakeld";
    case "invite_provider_unavailable":
      return "Provider onbereikbaar";
    default:
      return "Verzending mislukt";
  }
}

export function invitationDeliveryRecovery(errorCode?: string | null) {
  switch (errorCode) {
    case "invite_smtp_not_configured":
      return "Configureer Custom SMTP in het production Supabase-project en verstuur daarna een nieuwe link.";
    case "invite_rate_limited":
      return "Wacht tot de verzendlimiet is hersteld of controleer de Auth-rate-limit en verstuur daarna opnieuw.";
    case "invite_existing_account":
      return "Dit adres heeft al een account en kan niet opnieuw als nieuw Auth-account worden uitgenodigd.";
    case "invite_email_provider_disabled":
      return "Schakel e-mailauthenticatie en Custom SMTP in het production Supabase-project in.";
    case "invite_provider_unavailable":
      return "Controleer de SMTP-provider en probeer opnieuw zodra deze bereikbaar is.";
    default:
      return "Controleer Supabase Auth Logs en Custom SMTP en verstuur daarna een nieuwe link.";
  }
}
