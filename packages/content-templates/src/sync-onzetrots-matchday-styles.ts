/** Keep the established three panels and card typography. Portrait originally
 * reserved one result card; a checked pool selection needs its other cards too.
 * Historical own-team-only payloads retain their original geometry. */
export const syncOnzeTrotsMatchdayCss = `
.ot-approved-scope .portrait[data-ot-pool-results="2"] .dashboard-results,.ot-v9-scope .portrait[data-ot-pool-results="2"] .dashboard-results{height:392px}
.ot-approved-scope .portrait[data-ot-pool-results="3"] .dashboard-results,.ot-v9-scope .portrait[data-ot-pool-results="3"] .dashboard-results{height:540px}
.ot-approved-scope .portrait[data-ot-pool-results] .dashboard-results .match-card,.ot-v9-scope .portrait[data-ot-pool-results] .dashboard-results .match-card{display:block;flex:1;min-height:0;padding:17px 25px}
`;
