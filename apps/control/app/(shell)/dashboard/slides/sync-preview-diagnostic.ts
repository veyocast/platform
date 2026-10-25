export type SyncPreviewPhase='rpc'|'envelope'|'assets'|'payload'|'projector';

/** Only allowlisted phase/code metadata enters logs or the UI. Database text,
 * provider URLs, credentials and source payloads never enter diagnostics. */
export function syncPreviewFailure(phase:SyncPreviewPhase,rawCode:string|undefined,correlationId:string){
 const code=rawCode&&/^(?:[0-9A-Z]{5}|PGRST[0-9]{3}|SYNC_[A-Z_]+)$/.test(rawCode)?rawCode:'UNKNOWN';
 const cause=phase==='assets'?'Een bronafbeelding is nog niet beschikbaar. Controleer de mediaverwerking bij Bronnen en probeer opnieuw.'
  :phase==='payload'?'De brongegevens passen niet bij het huidige afspeelcontract. Controleer de bron en probeer na herstel opnieuw.'
  :phase==='projector'?(code==='SYNC_PRESENTATION_BOUNDS_EXCEEDED'?'De geselecteerde inhoud overschrijdt de ontwerpgrenzen. Beperk de selectie of verdeel de inhoud over meerdere ontwerpen.'
   :code==='SYNC_CANONICAL_FRESHNESS_INVALID'?'Het gecontroleerde bronmoment ontbreekt of is verouderd. Controleer de laatste geslaagde synchronisatie bij Bronnen en ververs de bron daar zo nodig expliciet.'
   :code==='SYNC_CANONICAL_IDENTITY_INVALID'?'De wedstrijdgegevens horen niet allemaal bij het gekozen team en de competitie. Controleer de bronselectie en probeer na herstel opnieuw.'
   :'De gecontroleerde brongegevens passen niet bij dit ontwerp. Controleer de bron; blijft dit gebeuren, geef de controlecode door.')
  :phase==='envelope'?'De broncontrole gaf een onvolledig antwoord. Probeer opnieuw; blijft dit gebeuren, geef de controlecode door.'
  :code==='42501'?'Je bronrechten of verenigingscontext zijn niet bevestigd. Open Bronnen binnen de juiste vereniging en controleer je toegang.'
  :code==='P2911'?'De actuele competitie is niet eenduidig. Kies bij Inhoud een team en een expliciete competitie; controleer de bron daarna opnieuw.'
  :code==='P2912'?'De gekozen competitie of het seizoen is niet meer beschikbaar. Kies een actuele competitie bij Inhoud; synchroniseer zo nodig expliciet bij Bronnen.'
  :code==='57014'||code==='08006'?'De opgeslagen brongegevens konden tijdelijk niet worden gelezen. Probeer de controle opnieuw.'
  :code==='PGRST202'?'Het benodigde broncontract is nog niet beschikbaar. Laat de software-uitrol en databaseversie controleren en probeer daarna opnieuw.'
  :code==='23514'||code==='22023'?'De opgeslagen bronselectie is niet geldig voor dit ontwerp. Controleer team, competitie en periode bij Inhoud en probeer opnieuw.'
  :'De broncontrole kon niet worden voltooid. Controleer de bronstatus en probeer opnieuw.';
 return {ok:false as const,phase,code,correlationId,error:`${cause} Je invoer en het laatst goede ontwerp blijven behouden. Controlecode: ${correlationId}.`};
}
