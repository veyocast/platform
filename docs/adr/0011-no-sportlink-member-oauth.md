# ADR 0011: no Sportlink member OAuth in ClubTV

Status: accepted.

The narrowcasting integration excludes address-book and `mijn-*` articles.
They require member identity/scopes or expose financial and private profile
data, while public club, team and competition articles cover ClubTV needs.

VeyoCast therefore implements no Sportlink member OAuth, token storage,
personal synchronization or shortcodes. A future member portal requires a
separate threat model, lawful-basis review, consent/visibility rules, retention
policy and product decision.
