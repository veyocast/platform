/** Same-origin Engage projection for the standalone ES5 Player.
 * The immutable Sites/binary fallback remains authoritative until a real public
 * campaign and its local QR have rendered. Campaign polling never changes a
 * slide, release, configuration, or the running item deadline.
 */
export const legacyEngageCss = ".engage-playback {\n  --accent: var(--player-accent, #6a8ef3);\n  --accent-soft: var(--player-accent-soft, #192955);\n  --bg: var(--player-bg, #0a1124);\n  --canvas-end: #0c1428;\n  --canvas-start: #131c34;\n  --deep: #070e22;\n  --flow-accent: #2459ed;\n  --ink: var(--player-ink, #f5f7fb);\n  --line: var(--player-line, #434c61);\n  --muted: var(--player-muted, #b2b6be);\n  --on-accent: var(--player-on-accent, #101010);\n  --secondary-accent: var(--accent);\n  --solid-accent: #2459ed;\n  --surface: var(--player-surface, #17213a);\n  --surface-2: var(--player-surface-2, #1f2a49);\n  background: linear-gradient(135deg, var(--canvas-start), var(--bg) 50%, var(--canvas-end));\n  color: var(--ink);\n  display: grid;\n  font-family: var(--vc-theme-body-font, \"Roboto\"), Arial, sans-serif;\n  gap: 20px;\n  grid-template-rows: 80px auto minmax(0, 1fr);\n  height: 100%;\n  isolation: isolate;\n  overflow: hidden;\n  padding: 32px 64px 76px 150px;\n  position: relative;\n  width: 100%;\n}\n\n.engage-playback__flow {\n  top: 0; right: 0; bottom: 0; left: 0;\n  overflow: hidden;\n  pointer-events: none;\n  position: absolute;\n  z-index: -1;\n}\n\n.engage-playback__flow span {\n  border: 2px solid var(--flow-accent);\n  border-radius: 50%;\n  opacity: .17;\n  position: absolute;\n}\n\n.engage-playback__flow span:nth-child(1) {\n  height: 560px;\n  right: -210px;\n  top: -230px;\n  transform: rotate(24deg);\n  width: 780px;\n}\n\n.engage-playback__flow span:nth-child(2) {\n  bottom: -440px;\n  height: 700px;\n  left: -430px;\n  transform: rotate(-16deg);\n  width: 1050px;\n}\n\n.engage-playback__flow span:nth-child(3) {\n  bottom: -250px;\n  height: 330px;\n  opacity: .08;\n  right: 190px;\n  transform: rotate(-22deg);\n  width: 460px;\n}\n\n.engage-playback__sideband {\n  align-items: center;\n  background: var(--deep);\n  bottom: 0;\n  color: var(--muted);\n  display: flex;\n  flex-direction: column;\n  font-size: 14px;\n  font-weight: 800;\n  justify-content: space-between;\n  left: 0;\n  letter-spacing: .16em;\n  padding: 52px 16px 46px;\n  position: absolute;\n  top: 0;\n  transform: rotate(180deg);\n  text-transform: uppercase;\n  width: 112px;\n  writing-mode: vertical-rl;\n  z-index: 3;\n}\n\n.engage-playback__sideband b {\n  color: var(--accent);\n  font-size: 42px;\n  letter-spacing: 0;\n  transform: rotate(90deg);\n  writing-mode: horizontal-tb;\n}\n\n.engage-playback__masthead,\n.engage-playback__title {\n  align-items: center;\n  background: var(--surface);\n  border: 1px solid var(--line);\n  display: flex;\n  justify-content: space-between;\n  min-height: 0;\n  min-width: 0;\n  position: relative;\n  z-index: 2;\n}\n\n.engage-playback__masthead {\n  border-radius: 20px;\n  padding: 0 32px;\n}\n\n.engage-playback__masthead strong {\n  font-size: 24px;\n  letter-spacing: -.02em;\n}\n\n.engage-playback__masthead span,\n.engage-playback__footer {\n  color: var(--muted);\n  font-size: 14px;\n  font-weight: 800;\n  letter-spacing: .1em;\n  text-transform: uppercase;\n}\n\n.engage-playback__title {\n  border-radius: 24px;\n  min-height: 148px;\n  padding: 20px 32px;\n}\n\n.engage-playback__title > div:first-child {\n  min-width: 0;\n}\n\n.engage-playback__title h1 {\n  font-family: var(--vc-theme-display-font, \"Roboto\"), Arial, sans-serif;\n  font-size: calc(62px * var(--vc-theme-base-scale, 1));\n  font-weight: 800;\n  letter-spacing: -.04em;\n  line-height: 1.04;\n  margin: 10px 0 0;\n  overflow-wrap: anywhere;\n}\n\n.engage-playback__eyebrow {\n  color: var(--accent);\n  display: block;\n  font-size: 17px;\n  font-weight: 800;\n  letter-spacing: .12em;\n  line-height: 1.1;\n  text-transform: uppercase;\n}\n\n.engage-playback__title-stat {\n  align-items: flex-end;\n  display: flex;\n  flex: 0 0 auto;\n  flex-direction: column;\n  gap: 4px;\n  margin-left: 28px;\n}\n\n.engage-playback__title-stat strong {\n  color: var(--accent);\n  font-size: 58px;\n  letter-spacing: -.04em;\n  line-height: .9;\n}\n\n.engage-playback__title-stat span {\n  color: var(--muted);\n  font-size: 13px;\n  font-weight: 800;\n  letter-spacing: .14em;\n  text-transform: uppercase;\n}\n\n.engage-playback__body {\n  display: grid;\n  gap: 24px;\n  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);\n  margin: 0;\n  padding: 0;\n  min-height: 0;\n  min-width: 0;\n}\n\n.engage-playback__results,\n.engage-playback__callout {\n  background: var(--surface);\n  border: 1px solid var(--line);\n  border-radius: 24px;\n  min-height: 0;\n  min-width: 0;\n  padding: 32px;\n}\n\n.engage-playback__results {\n  background: linear-gradient(145deg, var(--surface) 45%, var(--accent-soft));\n  display: grid;\n  gap: 20px;\n  grid-template-rows: auto minmax(0, 1fr) auto;\n}\n\n.engage-playback__results h1,\n.engage-playback__callout h2 {\n  font-family: var(--vc-theme-display-font, \"Roboto\"), Arial, sans-serif;\n  font-size: calc(45px * var(--vc-theme-base-scale, 1));\n  letter-spacing: -.035em;\n  line-height: 1.05;\n  margin: 12px 0 0;\n}\n\n.engage-playback__rows {\n  display: grid;\n  gap: 16px;\n  grid-auto-rows: minmax(0, 1fr);\n  list-style: none;\n  margin: 0;\n  min-height: 0;\n  overflow: hidden;\n  padding: 0;\n}\n\n.engage-playback__rows li {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  justify-content: center;\n  min-height: 0;\n}\n\n.engage-playback[data-option-count=\"7\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"8\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"9\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"10\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"11\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"12\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"13\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"14\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"15\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"16\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"17\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"18\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"19\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"20\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"21\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"22\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"23\"] .engage-playback__rows,\n.engage-playback[data-option-count=\"24\"] .engage-playback__rows {\n  grid-auto-flow: column;\n  grid-template-rows: repeat(6, minmax(0, 1fr));\n}\n\n.engage-playback__identity {\n  align-items: center;\n  display: grid;\n  gap: 18px;\n  grid-template-columns: 48px minmax(0, 1fr) auto;\n}\n\n.engage-playback__rank {\n  align-items: center;\n  background: var(--surface);\n  border: 1px solid var(--line);\n  border-radius: 12px;\n  color: var(--muted);\n  display: flex;\n  font-size: 21px;\n  font-weight: 700;\n  height: 48px;\n  justify-content: center;\n  width: 48px;\n}\n\n.engage-playback__identity strong {\n  font-size: calc(35px * var(--vc-theme-base-scale, 1));\n  letter-spacing: -.025em;\n  line-height: 1.1;\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.engage-playback__identity b {\n  color: var(--accent);\n  font-size: calc(54px * var(--vc-theme-base-scale, 1));\n  font-variant-numeric: tabular-nums;\n  letter-spacing: -.04em;\n  line-height: 1;\n  white-space: nowrap;\n}\n\n.engage-playback__identity b small {\n  font-size: calc(25px * var(--vc-theme-base-scale, 1));\n  margin-left: 5px;\n}\n\n.engage-playback__track {\n  background: var(--accent-soft);\n  border-radius: 10px;\n  height: 30px;\n  overflow: hidden;\n}\n\n.engage-playback__track i {\n  background: linear-gradient(90deg, var(--solid-accent), var(--secondary-accent));\n  border-radius: inherit;\n  display: block;\n  height: 100%;\n  transform: scaleX(0);\n  transform-origin: left;\n  transition: transform 1400ms cubic-bezier(.22, 1, .36, 1);\n  transition-delay: calc(180ms + var(--engage-order) * 160ms);\n  width: 100%;\n}\n\n.engage-playback__results[data-bars-ready=\"true\"] .engage-playback__track i {\n  transform: scaleX(var(--engage-progress));\n}\n\n.engage-playback__results > footer {\n  align-items: baseline;\n  border-top: 1px solid var(--line);\n  display: flex;\n  gap: 12px;\n  padding-top: 16px;\n}\n\n.engage-playback__results > footer strong {\n  color: var(--accent);\n  font-size: calc(34px * var(--vc-theme-base-scale, 1));\n  line-height: 1;\n}\n\n.engage-playback__results > footer span {\n  color: var(--muted);\n  font-size: 17px;\n  font-weight: 700;\n  letter-spacing: .06em;\n}\n\n.engage-playback__results > footer span:last-child {\n  margin-left: auto;\n  text-transform: uppercase;\n}\n\n.engage-playback__result-state {\n  align-content: center;\n  display: grid;\n  gap: 14px;\n  justify-items: start;\n}\n\n.engage-playback__result-state strong {\n  font-size: calc(38px * var(--vc-theme-base-scale, 1));\n  line-height: 1.16;\n  max-width: 24ch;\n}\n\n.engage-playback__result-state span {\n  color: var(--muted);\n  font-size: calc(20px * var(--vc-theme-base-scale, 1));\n}\n\n.engage-playback__callout {\n  display: flex;\n  flex-direction: column;\n  gap: 24px;\n  justify-content: space-between;\n}\n\n.engage-playback__callout h2 {\n  font-size: calc(48px * var(--vc-theme-base-scale, 1));\n  letter-spacing: -.04em;\n  margin: 20px 0 18px;\n}\n\n.engage-playback__callout p {\n  font-size: calc(28px * var(--vc-theme-base-scale, 1));\n  line-height: 1.25;\n  margin: 0 0 16px;\n}\n\n.engage-playback__callout small {\n  color: var(--muted);\n  display: block;\n  font-size: 17px;\n}\n\n.engage-playback__qr {\n  align-self: flex-end;\n}\n\n.engage-playback__qr img {\n  background: #fff;\n  display: block;\n  height: 212px;\n  image-rendering: pixelated;\n  padding: 12px;\n  width: 212px;\n}\n\n.engage-playback__closed-state {\n  align-items: center;\n  align-self: stretch;\n  background: var(--accent-soft);\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  color: var(--accent);\n  display: flex;\n  font-size: calc(22px * var(--vc-theme-base-scale, 1));\n  justify-content: center;\n  min-height: 92px;\n  padding: 20px;\n  text-align: center;\n}\n\n.engage-playback__footer {\n  align-items: center;\n  bottom: 22px;\n  display: flex;\n  height: 34px;\n  justify-content: space-between;\n  left: 150px;\n  position: absolute;\n  right: 64px;\n}\n\n@media (orientation: portrait) {\n  .engage-playback {\n    gap: 24px;\n    grid-template-rows: 96px auto minmax(0, 1fr);\n    padding: 36px 38px 84px 101px;\n  }\n\n  .engage-playback__sideband {\n    font-size: 11px;\n    padding: 30px 10px 28px;\n    width: 72px;\n  }\n\n  .engage-playback__sideband b {\n    font-size: 29px;\n  }\n\n  .engage-playback__masthead {\n    padding: 0 26px;\n  }\n\n  .engage-playback__masthead strong {\n    font-size: 22px;\n  }\n\n  .engage-playback__masthead span {\n    font-size: 12px;\n  }\n\n  .engage-playback__title {\n    min-height: 192px;\n    padding: 26px;\n  }\n\n  .engage-playback__title h1 {\n    font-size: calc(54px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__body {\n    grid-template-columns: 1fr;\n    grid-template-rows: minmax(0, 2fr) minmax(0, 1fr);\n  }\n\n  .engage-playback__results,\n  .engage-playback__callout {\n    padding: 38px;\n  }\n\n  .engage-playback__results {\n    gap: 26px;\n  }\n\n  .engage-playback__results h1 {\n    font-size: calc(53px * var(--vc-theme-base-scale, 1));\n    margin-top: 15px;\n  }\n\n  .engage-playback__rows {\n    gap: 24px;\n  }\n\n  .engage-playback__rows li {\n    gap: 24px;\n  }\n\n  .engage-playback__identity {\n    grid-template-columns: 54px minmax(0, 1fr) auto;\n  }\n\n  .engage-playback__rank {\n    border-radius: 14px;\n    font-size: 24px;\n    height: 54px;\n    width: 54px;\n  }\n\n  .engage-playback__identity strong {\n    font-size: calc(39px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__identity b {\n    font-size: calc(64px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__identity b small {\n    font-size: calc(27px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__track {\n    border-radius: 12px;\n    height: 40px;\n  }\n\n  .engage-playback__results > footer {\n    gap: 14px;\n    padding-top: 22px;\n  }\n\n  .engage-playback__results > footer strong {\n    font-size: calc(42px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__results > footer span {\n    font-size: 20px;\n  }\n\n  .engage-playback__callout {\n    align-items: center;\n    display: grid;\n    gap: 30px;\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .engage-playback__callout h2 {\n    font-size: calc(48px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__callout p {\n    font-size: calc(29px * var(--vc-theme-base-scale, 1));\n  }\n\n  .engage-playback__callout small {\n    font-size: 19px;\n  }\n\n  .engage-playback__qr img {\n    height: 205px;\n    width: 205px;\n  }\n\n  .engage-playback__footer {\n    bottom: 24px;\n    font-size: 14px;\n    height: 40px;\n    left: 101px;\n    right: 38px;\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .engage-playback__rows li {\n    animation: none !important;\n  }\n\n  .engage-playback__track i {\n    transform: scaleX(var(--engage-progress));\n    transition: none !important;\n  }\n}\n\n.engage-playback[data-motion-state=\"on\"] .engage-playback__rows li {\n  animation: engage-card-reveal 650ms both;\n  animation-delay: calc(var(--engage-order) * 90ms);\n}\n\n.engage-playback[data-motion-state=\"off\"] .engage-playback__rows li {\n  animation: none;\n}\n\n.engage-playback[data-motion-state=\"off\"] .engage-playback__track i {\n  transform: scaleX(var(--engage-progress));\n  transition: none;\n}\n\n@keyframes engage-card-reveal {\n  from { opacity: 0; transform: translateY(16px); }\n  to { opacity: 1; transform: translateY(0); }\n}";

export function lgSitesEngageScript() {
  return `
    var legacyEngageWork = null;
    function cancelLegacyEngage() {
      var work = legacyEngageWork;
      legacyEngageWork = null;
      if (!work) return;
      work.disposed = true;
      window.clearInterval(work.timer);
      window.clearTimeout(work.readyTimer);
      if (work.transport) work.transport.abort();
    }
    function lgEngageLabel(value, minimum, maximum) {
      return typeof value === "string" && value.trim().length >= minimum && value.trim().length <= maximum;
    }
    function lgEngageInteger(value, maximum) {
      return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value >= 0 && value <= maximum;
    }
    function lgEngageBinding(item) {
      var binding = item && item.onlinePlayback;
      return binding && binding.kind === "engage" && goalUuid(binding.publicId) &&
        lgEngageLabel(binding.question, 2, 160) && lgEngageLabel(binding.title, 2, 160) ? binding : null;
    }
    function lgEngageCampaign(value) {
      if (!goalRecord(value) || !goalUuid(value.id) || ["poll", "motm"].indexOf(value.kind) === -1 ||
        ["live", "closed"].indexOf(value.status) === -1 || typeof value.resultsVisible !== "boolean" ||
        ["after_vote", "after_close", "live"].indexOf(value.resultVisibility) === -1 ||
        !lgEngageLabel(value.title, 2, 160) || !lgEngageLabel(value.question, 2, 160) ||
        !lgEngageLabel(value.tenantName, 2, 160) || !lgEngageLabel(value.privacyNotice, 8, 500) ||
        !lgEngageInteger(value.totalVotes, 9007199254740991) ||
        !(value.closesAt === null || typeof value.closesAt === "string" && isFinite(Date.parse(value.closesAt))) ||
        !Array.isArray(value.options) || value.options.length < 2 || value.options.length > 24) return null;
      var seen = {};
      for (var index = 0; index < value.options.length; index += 1) {
        var option = value.options[index];
        if (!goalRecord(option) || !goalUuid(option.id) || seen[option.id] || !lgEngageLabel(option.label, 2, 160) ||
          !lgEngageInteger(option.sortOrder, 100) || !(typeof option.voteCount === "undefined" || lgEngageInteger(option.voteCount, 9007199254740991))) return null;
        seen[option.id] = true;
      }
      return value;
    }
    function lgEngagePercentage(option, total) {
      if (typeof option.voteCount === "undefined") return null;
      return total <= 0 ? 0 : Math.max(0, Math.min(100, option.voteCount / total * 100));
    }
    function lgEngageSurface(campaign, binding) {
      var active = campaign.status === "live";
      var root = templateNode("section", "engage-playback");
      root.setAttribute("aria-label", campaign.title);
      root.setAttribute("data-campaign-id", campaign.id);
      root.setAttribute("data-campaign-kind", campaign.kind);
      root.setAttribute("data-design-revision", "player-fallback");
      root.setAttribute("data-motion-state", "off");
      root.setAttribute("data-option-count", String(campaign.options.length));
      root.setAttribute("data-status", campaign.status);
      root.setAttribute("data-theme-mode", "dark");
      root.style.setProperty("--vc-theme-body-font", "VeyoCast Royal Current Roboto");
      var flow = templateNode("div", "engage-playback__flow"); flow.setAttribute("aria-hidden", "true");
      for (var curve = 0; curve < 3; curve += 1) flow.appendChild(document.createElement("span"));
      root.appendChild(flow);
      var side = templateNode("aside", "engage-playback__sideband"); side.setAttribute("aria-hidden", "true");
      side.appendChild(templateNode("span", "", campaign.tenantName)); side.appendChild(templateNode("b", "", "ENG")); side.appendChild(templateNode("span", "", "Jouw club · jouw stem")); root.appendChild(side);
      var masthead = templateNode("header", "engage-playback__masthead");
      masthead.appendChild(templateNode("strong", "", campaign.tenantName)); masthead.appendChild(templateNode("span", "", active ? "VeyoCast Engage · live" : "VeyoCast Engage · gesloten")); root.appendChild(masthead);
      var title = templateNode("section", "engage-playback__title"); var heading = document.createElement("div");
      heading.appendChild(templateNode("span", "engage-playback__eyebrow", campaign.title)); heading.appendChild(templateNode("h1", "", campaign.question)); title.appendChild(heading);
      var stat = templateNode("div", "engage-playback__title-stat"); stat.appendChild(templateNode("strong", "", String(campaign.totalVotes))); stat.appendChild(templateNode("span", "", campaign.totalVotes === 1 ? "stem" : "stemmen")); title.appendChild(stat); root.appendChild(title);
      var body = templateNode("div", "engage-playback__body"); var results = templateNode("section", "engage-playback__results");
      results.setAttribute("data-bars-ready", "true"); results.setAttribute("data-results-visible", String(campaign.resultsVisible));
      var resultHeading = document.createElement("header"); resultHeading.appendChild(templateNode("span", "engage-playback__eyebrow", campaign.kind === "motm" ? "Speler van de wedstrijd" : "Resultaten"));
      resultHeading.appendChild(templateNode("h1", "", campaign.resultsVisible ? active ? "Jullie tussenstand." : "Eindresultaat." : active ? "Tussenstand verborgen." : "Uitslag niet openbaar.")); results.appendChild(resultHeading);
      if (campaign.resultsVisible) {
        var rows = templateNode("ol", "engage-playback__rows");
        var options = campaign.options.slice().sort(function (left, right) { return left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "nl"); });
        options.forEach(function (option, index) {
          var percentage = lgEngagePercentage(option, campaign.totalVotes);
          var row = document.createElement("li"); row.setAttribute("data-option-id", option.id); row.style.setProperty("--engage-order", String(index));
          var identity = templateNode("div", "engage-playback__identity"); identity.appendChild(templateNode("span", "engage-playback__rank", String(index + 1).padStart(2, "0"))); identity.appendChild(templateNode("strong", "", option.label));
          var formatted = percentage === null ? "—" : percentage.toLocaleString("nl-NL", {maximumFractionDigits: percentage > 0 && percentage < 1 ? 1 : 0});
          var count = templateNode("b", "", formatted); count.appendChild(templateNode("small", "", percentage === null ? "" : "%")); identity.appendChild(count); row.appendChild(identity);
          var track = templateNode("div", "engage-playback__track"); track.setAttribute("role", "progressbar"); track.setAttribute("aria-label", option.label); track.setAttribute("aria-valuemin", "0"); track.setAttribute("aria-valuemax", "100");
          if (percentage === null) track.setAttribute("aria-valuetext", "Nog niet beschikbaar"); else track.setAttribute("aria-valuenow", String(percentage));
          var progress = document.createElement("i"); progress.style.setProperty("--engage-progress", String((percentage || 0) / 100)); track.appendChild(progress); row.appendChild(track); rows.appendChild(row);
        }); results.appendChild(rows);
      } else {
        var hidden = templateNode("div", "engage-playback__result-state"); hidden.setAttribute("role", "status"); hidden.appendChild(templateNode("strong", "", active ? "Stemmen kan zonder de actuele verdeling te tonen." : "Er is geen openbare eindstand.")); hidden.appendChild(templateNode("span", "", "VeyoCast vult geen ontbrekende percentages in.")); results.appendChild(hidden);
      }
      var totals = document.createElement("footer"); var total = document.createElement("span"); total.appendChild(templateNode("strong", "", String(campaign.totalVotes))); total.appendChild(document.createTextNode(campaign.totalVotes === 1 ? " geldige stem" : " geldige stemmen")); totals.appendChild(total); totals.appendChild(templateNode("span", "", active ? "Tussenstand" : "Eindstand")); results.appendChild(totals); body.appendChild(results);
      var callout = templateNode("aside", "engage-playback__callout"); callout.setAttribute("aria-label", active ? "Stemoproep" : "Campagnestatus"); var copy = templateNode("div", "engage-playback__callout-copy"); copy.appendChild(templateNode("span", "engage-playback__eyebrow", active ? "Jouw stem telt" : "Stemmen gesloten")); copy.appendChild(templateNode("h2", "", active ? "Laat van je horen." : "Bedankt voor het stemmen."));
      copy.appendChild(templateNode("p", "", active ? campaign.kind === "motm" ? "Scan de code en kies jouw speler." : "Scan de code en maak jouw keuze." : campaign.resultsVisible ? "De einduitslag staat hiernaast." : "De organisator maakt de uitslag afzonderlijk bekend.")); copy.appendChild(templateNode("small", "", campaign.tenantName)); callout.appendChild(copy);
      if (active) { var qr = templateNode("div", "engage-playback__qr"); var image = document.createElement("img"); image.alt = "QR-code voor " + campaign.title; image.src = "/api/player/engage/" + binding.publicId + "/qr"; qr.appendChild(image); callout.appendChild(qr); }
      else { var closed = templateNode("strong", "engage-playback__closed-state", "Campagne gesloten"); closed.setAttribute("role", "status"); callout.appendChild(closed); }
      body.appendChild(callout); root.appendChild(body);
      var footer = templateNode("footer", "engage-playback__footer"); footer.appendChild(templateNode("span", "", campaign.tenantName)); footer.appendChild(templateNode("span", "", active ? "Stemmen is geopend" : "Eindresultaat")); root.appendChild(footer);
      return root;
    }
    function lgEngageFallbackReady() {
      var work = legacyEngageWork;
      if (work && !work.disposed && work.generation === runtime.playbackGeneration && !work.started) {
        work.started = true;
        work.load();
      }
    }
    function playLegacyEngage(item, fallbackUrl, objectUrls, generation) {
      var binding = lgEngageBinding(item);
      if (!binding || runtime.offline || window.navigator.onLine === false) return false;
      var work = {disposed: false, generation: generation, transport: null, timer: null, readyTimer: null, started: false, busy: false, root: null, rendering: false};
      legacyEngageWork = work;
      function valid() { return !work.disposed && legacyEngageWork === work && generation === runtime.playbackGeneration && runtime.currentItem === item; }
      function project(campaign) {
        if (!valid() || runtime.goalPauseApplied || work.rendering) return;
        var content = lgEngageSurface(campaign, binding);
        var image = content.querySelector("img");
        var root = work.root;
        var width = item.sitesPresentation && item.sitesPresentation.orientation === "portrait" ? 1080 : 1920;
        var height = width === 1080 ? 1920 : 1080;
        var initial = !root;
        work.rendering = true;
        if (!root) {
          root = document.createElement("div"); root.className = "lg-engage-media";
          var style = document.createElement("style");
          var css = LEGACY_ENGAGE_CSS;
          var start = css.indexOf("@media (orientation: portrait)"); var opening = css.indexOf("{", start); var depth = 1; var end = opening + 1;
          while (start >= 0 && end < css.length && depth) { if (css.charAt(end) === "{") depth += 1; if (css.charAt(end) === "}") depth -= 1; end += 1; }
          if (start >= 0) css = width === 1080 ? css.slice(0, start) + css.slice(opening + 1, end - 1) + css.slice(end) : css.slice(0, start) + css.slice(end);
          style.textContent = lgSitesCompileCss(css, width, height).css;
          root.appendChild(style);
          var artboard = document.createElement("div"); artboard.className = "lg-engage-artboard"; artboard.style.width = width + "px"; artboard.style.height = height + "px"; root.appendChild(artboard);
          root.lgFit = function () { var scale = Math.min(root.clientWidth / width, root.clientHeight / height); artboard.style.left = (root.clientWidth - width * scale) / 2 + "px"; artboard.style.top = (root.clientHeight - height * scale) / 2 + "px"; artboard.style.transform = "scale(" + scale + ")"; };
          root.lgCleanup = function () { window.removeEventListener("resize", root.lgFit); };
        }
        function finish(ready) {
          window.clearTimeout(work.readyTimer); work.readyTimer = null;
          if (!valid() || runtime.goalPauseApplied || !ready) { work.rendering = false; return; }
          var board = root.querySelector(".lg-engage-artboard");
          while (board.firstChild) board.removeChild(board.firstChild);
          board.appendChild(content);
          if (initial) beginPendingMedia(root, []);
          Promise.resolve(document.fonts && document.fonts.ready).then(function () {
            if (!valid() || runtime.goalPauseApplied) { if (initial && runtime.pendingElement === root) cancelPendingMedia(); work.rendering = false; return; }
            window.requestAnimationFrame(function () {
              if (!valid()) return;
              root.lgFit();
              if (initial) {
                var deadline = runtime.playbackDeadlineAt || runtime.templateDeadlineAt;
                var remaining = deadline ? Math.max(1, deadline - monotonicNow()) : itemDurationMs(item);
                if (!commitPendingMedia(root, [], generation)) { work.rendering = false; return; }
                work.root = root;
                window.addEventListener("resize", root.lgFit);
                clearPlaybackTimers(); schedulePlaybackAdvance(remaining);
              }
              work.rendering = false;
            });
          });
        }
        if (!image) { finish(true); return; }
        var settled = false;
        function loaded(ready) { if (settled) return; settled = true; image.onload = image.onerror = null; finish(ready); }
        image.onload = function () { loaded(true); }; image.onerror = function () { loaded(false); };
        if (image.complete) { loaded(image.naturalWidth > 0); return; }
        work.readyTimer = window.setTimeout(function () { loaded(false); }, 5000);
      }
      work.load = function () {
        if (!valid() || !work.started || work.busy || work.rendering || runtime.goalPauseApplied || runtime.offline || window.navigator.onLine === false) return;
        work.busy = true;
        work.transport = request("GET", "/api/player/engage/" + binding.publicId, {"Cache-Control": "no-cache"}, null, function (code, status, body) {
          work.busy = false; work.transport = null;
          if (!valid() || code || status !== 200) return;
          var campaign = lgEngageCampaign(body);
          if (campaign) project(campaign);
        });
      };
      work.timer = window.setInterval(work.load, 5000);
      playLegacyVerifiedFallback(item, fallbackUrl, objectUrls, generation);
      return true;
    }
  `;
}
