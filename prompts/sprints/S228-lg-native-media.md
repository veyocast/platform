# S228 — LG native mediatransport

De gebruiker meldt dat menu's wel verschijnen maar afbeeldingen/video op
synchroniseren blijven staan. Productie en de LG draaien 20729be3. Onderzoek
actuele devicegegevens en het werkelijk toegewezen bestand vóór wijzigingen.
De eerdere niet-ontvangen diagnose is geen bewijs voor het huidige apparaat.

Ownership: apps/player/app/_lib/lg-legacy-page.ts, bijbehorende gerichte Player-
regressies, dit prompt, docs/s228-lg-native-media.md, PLANS.md en TASK_LEDGER.md.
Read-only tenantgebonden controle en bestaande beschermde videoprobe zijn
onderdeel van de opdracht. Een korte bestaande diagnoseopdracht mag met exacte
binding, vervaltijd en operationele audit worden verstuurd. Geen schema-,
dependency-, merkasset-, playlist-, provider- of native-shellwijzigingen.

Gebruik de bestaande immutable/device-geautoriseerde bron uitsluitend na
volledige releasevoorbereiding en weigering van lokale transporten. Geen
activate-on-play: een zichtbaar gedecodeerd frame blijft vereist. Bewaar een
werkelijk lokaal afspeelbare vorige release wanneer native HTTP nodig blijkt;
netwerkverlies en offline herstart mogen die niet door een onbruikbare video
vervangen. Behoud gezonde video-, overlay-, generatie- en compositiegrenzen.

Reproduceer eerst de gemeten transportweigering, test regressies, voer alle
gates uit, commit/push/PR en rol beschermd naar staging en productie binnen de
bestaande gebruikersautorisatie. Rapporteer fysieke ontvangst/afspelen alleen
met actuele devicebevestiging. Offline videoweergave op een firmware die beide
lokale routes weigert blijft een aparte beperking; claim geen codecwijziging.
