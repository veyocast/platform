# Sportlink privacy

VeyoCast stores presentation data, not member profiles. The normalization
boundary removes telephone numbers, e-mail, street/postal addresses, bank
details, IBAN/BIC, BSN, identifiers, relation codes, secretary names and
embedded base64 logos. Logo bytes use a separate bounded PNG path.

Person records contain at most display name, public role and an allowed photo.
Person, birthday and volunteer groups default off. Birthdays are limited to 21
days and never expose birth year or age. Expired date-bound records do not enter
new snapshots.

Sportlink visibility is respected but is not by itself permission to publish
on a clubhouse display. Activation requires an explicit tenant privacy choice
and audit event. Scoped `mijn-*`, address-book and financial articles are an
explicit no-go in this integration.
