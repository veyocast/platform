import type {
  PlaylistReadinessReason,
  PlaylistReadinessReasonCode
} from "@veyocast/domain";

const copy: Record<PlaylistReadinessReasonCode, { detail: string; label: string; recovery: string }> = {
  ASSET_KIND_UNSUPPORTED: { detail: "Dit mediatype kan niet door de Player worden afgespeeld.", label: "Mediatype niet ondersteund", recovery: "Vervang het item door een afbeelding of MP4-video." },
  ASSET_MISSING: { detail: "Het concept verwijst naar media die niet meer beschikbaar is.", label: "Media ontbreekt", recovery: "Verwijder het item of voeg vervangende media toe." },
  ASSET_NOT_READY: { detail: "De media wordt nog verwerkt of is afgekeurd.", label: "Media niet gereed", recovery: "Wacht op verwerking of herstel het bestand in Media." },
  ASSET_TENANT_MISMATCH: { detail: "Het item hoort niet bij de actieve vereniging.", label: "Onveilige mediakoppeling", recovery: "Verwijder het item en kies media uit deze vereniging." },
  ITEM_DURATION_INVALID: { detail: "De ingestelde duur valt buiten 5 tot en met 3600 seconden.", label: "Ongeldige itemduur", recovery: "Stel een geldige duur in bij de iteminstellingen." },
  ITEM_FIT_MODE_INVALID: { detail: "De uitsnede is niet compatibel met de Player.", label: "Ongeldige weergave", recovery: "Kies Volledig in beeld of Schermvullend." },
  PLAYER_VARIANT_MISSING: { detail: "De veilige afspeelvariant ontbreekt.", label: "Playervariant ontbreekt", recovery: "Verwerk de media opnieuw of vervang het item." },
  PLAYLIST_ARCHIVED: { detail: "Een gearchiveerde playlist kan niet worden gepubliceerd.", label: "Playlist gearchiveerd", recovery: "Maak een nieuw concept of herstel de playlist via beheer." },
  PLAYLIST_EMPTY: { detail: "Een release moet minimaal één item bevatten.", label: "Playlist is leeg", recovery: "Voeg gereedstaande media toe." },
  TARGET_ORIENTATION_UNSUPPORTED: { detail: "Een doelscherm heeft een oriëntatie die deze editor niet ondersteunt.", label: "Oriëntatie niet ondersteund", recovery: "Controleer de schermoriëntatie voordat je publiceert." },
  VARIANT_METADATA_INVALID: { detail: "Afmetingen of bestandsgrootte van de afspeelvariant ontbreken.", label: "Variantmetadata onvolledig", recovery: "Verwerk het bestand opnieuw in Media." },
  VARIANT_MIME_UNSUPPORTED: { detail: "De afspeelvariant heeft geen ondersteund bestandsformaat.", label: "Variantformaat niet ondersteund", recovery: "Verwerk het bestand opnieuw als JPEG, PNG, WebP of MP4/H.264." },
  VARIANT_TENANT_MISMATCH: { detail: "De afspeelvariant hoort niet bij de actieve vereniging.", label: "Onveilige variantkoppeling", recovery: "Verwijder het item en neem contact op met support." }
};

export function getReadinessCopy(reason: PlaylistReadinessReason) {
  return copy[reason.code];
}
