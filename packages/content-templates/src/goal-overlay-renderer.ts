/* eslint-disable no-var -- Shared renderer is embedded in the ES5 Static LG runtime. */
import type { GoalOverlayConfiguration, GoalOverlayEvent } from "@veyocast/contracts";
import { royalCurrentDefaultStyle, royalCurrentEditorialTokens } from "./royal-current-theme";

// Self-contained, trusted application code. Static LG embeds this exact function.
// Provider text is always textContent; neither templates nor URLs become HTML.
export function renderGoalOverlayDom(
  root: HTMLElement,
  config: GoalOverlayConfiguration,
  event: GoalOverlayEvent,
  orientation: "landscape" | "portrait",
  appearance: "light" | "dark"
) {
  var doc = root.ownerDocument;
  function color(value: unknown, fallback: string) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; }
  var primary = color(config.defaults && config.defaults.primary, color(event.teamPrimary, "var(--go-fallback-primary)"));
  var dark = appearance === "dark";
  var textColor = color(dark ? config.darkTextColor : config.lightTextColor, dark ? "#ffffff" : primary);
  var surface = config.defaults && config.defaults.darkSurface;
  var darkSurface = typeof surface === "string" && /^rgba?\([0-9.,\s]+\)$/.test(surface) ? surface : color(surface, "var(--go-fallback-dark)");
  var card = color(dark ? config.darkCardColor : config.lightCardColor, dark ? darkSurface : "#ffffff");
  function node(tag: string, className: string, text?: string | null) {
    var element = doc.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  function image(url: string | null, className: string, onFailure?: () => void) {
    if (!url || !/^(https?:\/\/|blob:|\/[^/])/.test(url)) return null;
    var element = doc.createElement("img");
    element.alt = "";
    element.className = className;
    element.onerror = function () { element.remove(); if (onFailure) onFailure(); resize(); };
    element.onload = resize;
    element.src = url;
    return element;
  };
  function template(value: string) { return value.replace(/\{([a-z_]+)\}/g, function (_match, key: string) {
    var values: Record<string, string> = {
      team: event.scoreboardSide === "home" ? event.homeTeam : event.awayTeam,
      scorer: event.scorer || "",
      home_team: event.homeTeam,
      away_team: event.awayTeam,
      home_score: String(event.homeScore),
      away_score: String(event.awayScore),
      minute: event.minute || ""
    };
    return values[key] || "";
  }).trim(); }
  while (root.firstChild) root.removeChild(root.firstChild);
  root.dataset.hasPhoto = "false";
  root.className = "vc-goal";
  root.dataset.orientation = orientation;
  root.dataset.theme = appearance;
  root.dataset.layout = config.layout;
  root.dataset.spacing = config.spacing;
  root.dataset.logoSize = config.logoSize;
  root.dataset.photoSize = config.photoSize;
  root.dataset.shadow = config.shadow ? "true" : "false";
  root.dataset.font = config.font;
  root.setAttribute("role", "status");
  root.setAttribute("aria-label", (event.test ? "Test · " : "") + "Doelpunt " + (event.scoreboardSide === "home" ? event.homeTeam : event.awayTeam));
  root.style.setProperty("--go-outer", color(dark ? config.darkOuterColor : config.lightOuterColor, primary));
  root.style.setProperty("--go-card", card);
  root.style.setProperty("--go-text", textColor);
  root.style.setProperty("--go-accent-text", color(config.accentTextColor, textColor));
  root.style.setProperty("--go-radius", String(Math.max(0, Math.min(64, config.radius || 0))) + "px");
  var container = node("div", "vc-goal-card");
  var copy = node("div", "vc-goal-copy");
  if (event.test) copy.appendChild(node("span", "vc-goal-test", "Test Goal Alert"));
  copy.appendChild(node("strong", "vc-goal-headline", template(config.headlineTemplate) || "GOAL!"));
  if (config.showScorer && event.scorer) {
    var scorer = node("div", "vc-goal-scorer");
    if (config.showShirtNumber && event.shirtNumber) scorer.appendChild(node("span", "vc-goal-number", "#" + event.shirtNumber));
    scorer.appendChild(node("strong", "", event.scorer));
    copy.appendChild(scorer);
  }
  if (config.showPlayerPhoto && event.playerPhoto) {
    var photo = image(event.playerPhoto, "vc-goal-photo", function () { root.dataset.hasPhoto = "false"; });
    if (photo) { container.appendChild(photo); root.dataset.hasPhoto = "true"; }
  } else root.dataset.hasPhoto = "false";
  var score = node("div", "vc-goal-scoreboard");
  score.setAttribute("aria-label", event.homeTeam + " " + event.homeScore + " — " + event.awayScore + " " + event.awayTeam);
  (["home", "away"] as const).forEach(function (side) {
    var team = node("div", "vc-goal-team");
    var name = side === "home" ? event.homeTeam : event.awayTeam;
    var logo: HTMLImageElement | null = null;
    if (config.showTeamLogos) {
      logo = image(side === "home" ? event.homeLogo : event.awayLogo, "vc-goal-logo", function () {
        if (!config.showTeamNames) team.insertBefore(node("span", "vc-goal-team-name", name), team.lastChild);
      });
      if (logo) team.appendChild(logo);
    }
    // The team name is the accessible/visible fallback for an absent logo.
    if (config.showTeamNames || !logo) {
      team.appendChild(node("span", "vc-goal-team-name", name));
    }
    team.appendChild(node("strong", "vc-goal-score", String(side === "home" ? event.homeScore : event.awayScore)));
    score.appendChild(team);
    if (side === "home") score.appendChild(node("span", "vc-goal-separator", "—"));
  });
  copy.appendChild(score);
  if (config.showMinute && event.minute) copy.appendChild(node("p", "vc-goal-minute", event.minute));
  var details = [config.showCompetition ? event.competition : null, config.showMatchName ? event.matchName : null, config.showRound ? event.round : null, config.showVenue ? event.venue : null].filter(Boolean).join(" · ");
  if (details) copy.appendChild(node("p", "vc-goal-detail", details));
  var goalText = template(config.goalTextTemplate);
  if (goalText) copy.appendChild(node("p", "vc-goal-detail", goalText));
  var subtitle = template(config.subtitleTemplate);
  if (subtitle) copy.appendChild(node("p", "vc-goal-subtitle", subtitle));
  container.appendChild(copy);
  root.appendChild(container);
  // Container-relative signage units also work on older LG Chromium without cqw.
  function resize() {
    var width = root.clientWidth;
    var height = root.clientHeight;
    if (width && height) {
      var unit = Math.min(width / 100, height / (orientation === "portrait" ? 150 : 56.25));
      root.style.setProperty("--go-unit", String(unit) + "px");
      // Reduce fluid typography for dense content; never transform a fixed canvas.
      for (var pass = 0; pass < 4 && container.scrollHeight > container.clientHeight + 1; pass++) {
        unit *= Math.max(.6, (container.clientHeight / container.scrollHeight) * .96);
        root.style.setProperty("--go-unit", String(unit) + "px");
      }
    }
  };
  resize();
  var observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(root);
  else if (doc.defaultView) doc.defaultView.addEventListener("resize", resize);
  return function () { if (observer) observer.disconnect(); else if (doc.defaultView) doc.defaultView.removeEventListener("resize", resize); };
}

export const goalOverlayCss = `
.vc-goal{--go-fallback-primary:${royalCurrentDefaultStyle.primary};--go-fallback-dark:${royalCurrentEditorialTokens(royalCurrentDefaultStyle, "dark").surface};--go-unit:1vw;box-sizing:border-box;width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--go-outer);color:var(--go-text);padding:5%;font-family:"Roboto",Arial,sans-serif;isolation:isolate}
.vc-goal *{box-sizing:border-box}.vc-goal p{margin:0}.vc-goal[data-font=body]{font-family:"Roboto",Arial,sans-serif}
.vc-goal-card{background:var(--go-card);color:var(--go-text);border-radius:var(--go-radius);width:100%;max-height:100%;padding:4%;display:flex;align-items:center;justify-content:center;gap:4%;position:relative;overflow:hidden}
.vc-goal[data-shadow=true] .vc-goal-card{box-shadow:0 1.5em 4em rgba(0,0,0,.2)}
.vc-goal-copy{min-width:0;flex:1;display:flex;align-items:center;flex-direction:column;gap:calc(var(--go-unit)*1.2);text-align:center}
.vc-goal-headline{font-size:calc(var(--go-unit)*7);line-height:1.05;letter-spacing:-.045em;overflow-wrap:anywhere;max-width:100%;color:var(--go-accent-text)}
.vc-goal[data-font=display] .vc-goal-headline{font-weight:900}.vc-goal[data-font=body] .vc-goal-headline{font-weight:700;letter-spacing:-.02em}
.vc-goal-scorer{display:flex;justify-content:center;align-items:baseline;flex-wrap:wrap;gap:.4em;font-size:calc(var(--go-unit)*2.7);line-height:1.1;overflow-wrap:anywhere}.vc-goal-number{font-size:.65em;opacity:.8}
.vc-goal-scoreboard{display:flex;width:100%;justify-content:center;align-items:flex-end;gap:4%}.vc-goal-team{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:calc(var(--go-unit)*.7)}
.vc-goal-team-name{font-size:calc(var(--go-unit)*1.8);line-height:1.15;overflow-wrap:anywhere;max-width:100%;font-weight:700}
.vc-goal-score{font-size:calc(var(--go-unit)*8);font-variant-numeric:tabular-nums;line-height:1;font-weight:900;letter-spacing:-.04em}.vc-goal-separator{font-size:calc(var(--go-unit)*4);line-height:1.6}
.vc-goal-logo{width:calc(var(--go-unit)*7);height:calc(var(--go-unit)*7);object-fit:contain;flex:none}.vc-goal[data-logo-size=small] .vc-goal-logo{width:calc(var(--go-unit)*5);height:calc(var(--go-unit)*5)}.vc-goal[data-logo-size=large] .vc-goal-logo{width:calc(var(--go-unit)*9);height:calc(var(--go-unit)*9)}
.vc-goal-photo{width:24%;max-height:85%;object-fit:contain;border-radius:calc(var(--go-radius)*.65);flex:none}.vc-goal[data-photo-size=small] .vc-goal-photo{width:18%}.vc-goal[data-photo-size=large] .vc-goal-photo{width:29%}
.vc-goal-minute{font-size:calc(var(--go-unit)*2.4);font-weight:800}.vc-goal-subtitle{font-size:calc(var(--go-unit)*2.2);font-weight:800;color:var(--go-accent-text);overflow-wrap:anywhere}.vc-goal-detail,.vc-goal-test{font-size:calc(var(--go-unit)*1.5);line-height:1.2}.vc-goal-test{font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.vc-goal[data-spacing=compact] .vc-goal-copy{gap:calc(var(--go-unit)*.65)}.vc-goal[data-spacing=generous] .vc-goal-copy{gap:calc(var(--go-unit)*1.7)}
.vc-goal[data-orientation=portrait]{padding:7%}.vc-goal[data-orientation=portrait] .vc-goal-card{flex-direction:column;padding:8% 5%;gap:calc(var(--go-unit)*4)}
.vc-goal[data-orientation=portrait] .vc-goal-copy{flex:none;width:100%;gap:calc(var(--go-unit)*3)}.vc-goal[data-orientation=portrait] .vc-goal-headline{font-size:calc(var(--go-unit)*10)}.vc-goal[data-orientation=portrait] .vc-goal-scorer{font-size:calc(var(--go-unit)*4.8)}
.vc-goal[data-orientation=portrait] .vc-goal-team-name{font-size:calc(var(--go-unit)*3.4)}.vc-goal[data-orientation=portrait] .vc-goal-score{font-size:calc(var(--go-unit)*14)}.vc-goal[data-orientation=portrait] .vc-goal-separator{font-size:calc(var(--go-unit)*6);line-height:1.8}
.vc-goal[data-orientation=portrait] .vc-goal-logo{width:calc(var(--go-unit)*12);height:calc(var(--go-unit)*12)}.vc-goal[data-orientation=portrait] .vc-goal-photo{width:30%;max-height:calc(var(--go-unit)*40);order:1}.vc-goal[data-orientation=portrait] .vc-goal-minute{font-size:calc(var(--go-unit)*4.5)}.vc-goal[data-orientation=portrait] .vc-goal-subtitle{font-size:calc(var(--go-unit)*4)}.vc-goal[data-orientation=portrait] .vc-goal-detail,.vc-goal[data-orientation=portrait] .vc-goal-test{font-size:calc(var(--go-unit)*2.7)}
.vc-goal[data-layout=player-focus][data-has-photo=true][data-orientation=landscape] .vc-goal-copy{align-items:flex-start;text-align:left}.vc-goal[data-layout=player-focus][data-has-photo=true] .vc-goal-headline{font-size:calc(var(--go-unit)*6)}
/* Margins preserve the same composition on Chromium versions without flex gap. */
.vc-goal-card,.vc-goal-copy,.vc-goal[data-spacing] .vc-goal-copy,.vc-goal-team,.vc-goal-scoreboard,.vc-goal-scorer,.vc-goal[data-orientation=portrait] .vc-goal-card,.vc-goal[data-orientation=portrait] .vc-goal-copy{gap:0}
.vc-goal-copy>*+*{margin-top:calc(var(--go-unit)*1.2)}.vc-goal-team>*+*{margin-top:calc(var(--go-unit)*.7)}.vc-goal-number{margin-right:.4em}.vc-goal-separator{margin:0 4%}
.vc-goal[data-orientation=landscape] .vc-goal-photo{margin-right:4%}
.vc-goal[data-orientation=portrait] .vc-goal-photo{margin-top:calc(var(--go-unit)*4)}
.vc-goal[data-orientation=portrait] .vc-goal-copy>*+*{margin-top:calc(var(--go-unit)*3)}
.vc-goal[data-spacing=compact] .vc-goal-copy>*+*{margin-top:calc(var(--go-unit)*.65)}.vc-goal[data-spacing=generous] .vc-goal-copy>*+*{margin-top:calc(var(--go-unit)*1.7)}
.vc-goal[data-orientation=portrait][data-logo-size=small] .vc-goal-logo{width:calc(var(--go-unit)*9);height:calc(var(--go-unit)*9)}.vc-goal[data-orientation=portrait][data-logo-size=large] .vc-goal-logo{width:calc(var(--go-unit)*15);height:calc(var(--go-unit)*15)}
.vc-goal[data-orientation=portrait][data-photo-size=small] .vc-goal-photo{width:24%}.vc-goal[data-orientation=portrait][data-photo-size=large] .vc-goal-photo{width:38%}
`;
