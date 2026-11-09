/** Keep the established three panels and card typography. Portrait originally
 * reserved one result card; a checked pool selection needs its other cards too.
 * Historical own-team-only payloads retain their original geometry. */
export const syncOnzeTrotsMatchdayCss = `
.ot-approved-scope .portrait[data-ot-pool-results="2"] .dashboard-results,.ot-v9-scope .portrait[data-ot-pool-results="2"] .dashboard-results{height:392px}
.ot-approved-scope .portrait[data-ot-pool-results="3"] .dashboard-results,.ot-v9-scope .portrait[data-ot-pool-results="3"] .dashboard-results{height:540px}
.ot-approved-scope .portrait[data-ot-pool-results] .dashboard-results .match-card,.ot-v9-scope .portrait[data-ot-pool-results] .dashboard-results .match-card{display:block;flex:1;min-height:0;padding:17px 25px}
/* Reserve both landscape programme rows even when the final page has only
 * one, two or three matches. Card contents keep the full-page first-row height. */
.ot-approved-scope .screen:not(.portrait) .program-panel .matches-grid,.ot-v9-scope .screen:not(.portrait) .program-panel .matches-grid{grid-template-rows:repeat(2,minmax(0,1fr))}
`;
