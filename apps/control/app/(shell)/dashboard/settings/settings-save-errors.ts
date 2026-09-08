type TenantSettingsSaveError = {
  code?: string | null;
  message?: string | null;
};

export function tenantSettingsSaveErrorMessage(error: TenantSettingsSaveError) {
  const code = error.code ?? "";
  const message = error.message?.toLowerCase() ?? "";

  if (code === "40001") {
    return "Opslaan geblokkeerd omdat deze instellingen intussen zijn gewijzigd. Er is niets overschreven; vernieuw de pagina en pas je wijziging opnieuw toe.";
  }
  if (code === "42501") {
    return "Je account mag deze tenantinstellingen niet wijzigen. Er is niets opgeslagen; vraag een tenantbeheerder om de juiste rechten.";
  }
  if (code === "PGRST202" || code === "42883") {
    return "De databasecommand voor deze instellingen ontbreekt. Er is niets opgeslagen; laat een platformbeheerder de nieuwste databasemigraties uitvoeren.";
  }
  if (code === "57014") {
    return "De veilige theme-uitrol duurde langer dan toegestaan. Er is niets gedeeltelijk gewijzigd; probeer opnieuw wanneer er geen andere publicatie actief is en neem contact op met een platformbeheerder als dit terugkomt.";
  }
  if (code === "23514" && message.includes("menu documents must use fieldflow")) {
    return "Een oudere Menu Studio-slide blokkeert de stijlwijziging. Er is niets opgeslagen; laat een platformbeheerder de compatibiliteitshotfix uitvoeren en probeer daarna opnieuw.";
  }
  if (code === "23514") {
    return "Een kleur of bestaande contentconfiguratie voldoet niet aan de veilige stijlregels. Er is niets opgeslagen; controleer de gemarkeerde contrasten en probeer opnieuw.";
  }
  return "De instellingen konden niet veilig worden opgeslagen. Er is niets gedeeltelijk gewijzigd; vernieuw de pagina en probeer opnieuw.";
}
