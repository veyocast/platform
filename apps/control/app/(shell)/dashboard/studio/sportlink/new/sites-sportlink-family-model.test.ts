import { describe, expect, it } from "vitest";
import { sportDynamicSlideTypes, type ThemeSelection } from "@veyocast/contracts";
import { createSitesSourceDesign } from "./sites-source-design";
import { buildSitesSportlinkFamilyDraft, canonicalSitesSportlinkFamilyConfiguration, initialSitesSportlinkFamilySelection, parseSitesSportlinkFamilyDraft, sitesSportlinkAutoContext } from "./sites-sportlink-family-model";

const theme:ThemeSelection={accent:"#2459ED",categoryOverrides:[],modePolicy:{kind:"fixed",mode:"light"},ref:{catalog:"v2",id:"fieldflow",version:"1.0.0"},support:null};
const template="a1910000-0000-4000-8000-000000002601";
function draft(family:(typeof sportDynamicSlideTypes)[number]){return buildSitesSportlinkFamilyDraft({family,name:"Echte selectie",templateVersionId:template,design:createSitesSourceDesign("sportlink","Actuele clubgegevens"),contexts:[sitesSportlinkAutoContext("provider-team-41")],allTeams:false,themeSelection:theme});}
describe("Sportlink-familiewizard gebruikt getypte bronselecties",()=>{
 it("bouwt alle zeventien families en bewaart de volledige keuze voor save/reload",()=>{
  expect(sportDynamicSlideTypes).toHaveLength(17);
  for(const family of sportDynamicSlideTypes){const value=draft(family);expect(parseSitesSportlinkFamilyDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);expect(value.configuration.sitesConfiguration.provider).toBe("sportlink");}
 });
 it("vertaalt clubprogramma en uitslagen naar hun bestaande selectiecontract en aankomsten naar expliciete contexts",()=>{
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_program"))).toMatchObject({blueprintKey:"sportlink.club_schedule_next_7_days",teamSelection:{mode:"selected",teamContexts:[{providerTeamId:"provider-team-41"}]}});
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_results")).blueprintKey).toBe("sportlink.club_results_previous_7_days");
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_referee_arrivals"))).toMatchObject({blueprintKey:"sportlink.referee_arrivals",teamContexts:[{providerTeamId:"provider-team-41"}]});
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_referee_arrivals"))).not.toHaveProperty("teamSelection");
 });
 it("behoudt de echte provider-ID voor teamgerichte families en zet geen verboden clubfilter op clubactiviteiten",()=>{
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_trainings"))).toMatchObject({sourceTeamSelection:{mode:"selected",teamContexts:[{providerTeamId:"provider-team-41"}]}});
  expect(canonicalSitesSportlinkFamilyConfiguration(draft("sport_activities"))).not.toHaveProperty("teamSelection");
 });
 it("begint een teamgebonden familie met één echt team en aankomsten met een begrensde expliciete selectie",()=>{
  expect(initialSitesSportlinkFamilySelection("sport_standing",["team-b","team-a"])).toEqual({allTeams:false,teamIds:["team-b"]});
  expect(initialSitesSportlinkFamilySelection("sport_standing",[])).toEqual({allTeams:false,teamIds:[]});
  expect(initialSitesSportlinkFamilySelection("sport_visitor_arrivals",["team-b","team-b","team-a"])).toEqual({allTeams:false,teamIds:["team-b","team-a"]});
  expect(initialSitesSportlinkFamilySelection("sport_visitor_arrivals",Array.from({length:600},(_,index)=>String(index))).teamIds).toHaveLength(500);
  expect(initialSitesSportlinkFamilySelection("sport_program",["team-b"])).toEqual({allTeams:true,teamIds:[]});
 });
 it("weigert gemengde providerconfiguratie, uitvoerbare velden en verjaardagskeuzes op een andere familie",()=>{
  const value=draft("sport_program");
  expect(parseSitesSportlinkFamilyDraft({...value,configuration:{...value.configuration,sitesConfiguration:{...value.configuration.sitesConfiguration,provider:"menu"}}})).toBeNull();
  expect(parseSitesSportlinkFamilyDraft({...value,configuration:{...value.configuration,html:"<script>ignored</script>"}})).toBeNull();
  expect(parseSitesSportlinkFamilyDraft({...value,configuration:{...value.configuration,birthday:draft("sport_birthdays").configuration.birthday}})).toBeNull();
  expect(parseSitesSportlinkFamilyDraft({...draft("sport_birthdays"),configuration:{...draft("sport_birthdays").configuration,birthday:undefined}})).toBeNull();
 });
});
