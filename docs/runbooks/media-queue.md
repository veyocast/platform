# Runbook — mediaqueue

## Signaal

De oudste wachtende mediajob is langer dan 60 seconden niet geclaimd.

## Herstel

1. Open `/dashboard/media?status=processing` en bepaal oudste job en tenantimpact.
2. Controleer worker-readiness, queuepoll en leaseleeftijd zonder signed URL of bronpad te loggen.
3. Herstart één worker alleen wanneer drain is bevestigd; een lease mag pas na de bestaande timeout opnieuw worden geclaimd.
4. Schaal niet op bij een storage-, database- of FFmpeg-storing; herstel eerst de oorzaak.
5. Bevestig dat de oudste job binnen één minuut start en archiveer eventcode, revision en tijden.

Eigenaar: Platform operations.
