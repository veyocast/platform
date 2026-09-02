import type { editorialArenaActiveSlideTypes } from "@veyocast/contracts";

type FieldFlowSlideType = (typeof editorialArenaActiveSlideTypes)[number];

/**
 * Closed, machine-checkable projection inventory. Adding a contract type to
 * editorialArenaActiveSlideTypes is a compile failure until its FieldFlow
 * family is chosen deliberately.
 */
export const fieldflowSlideFamilyByType = {
  menu: "menu-board",
  news: "news",
  price_list: "price-list",
  sport_activities: "agenda-list",
  sport_birthdays: "birthday",
  sport_cancellations: "cancellation-list",
  sport_dressing_rooms: "room-list",
  sport_match_of_the_day: "match-hero",
  sport_next_match: "match-hero",
  sport_officials: "official-list",
  sport_period_standing: "period-standing-table",
  sport_program: "fixture-list",
  sport_referee_arrivals: "referee-arrivals",
  sport_results: "result-list",
  sport_sponsor: "sponsor-spotlight",
  sport_standing: "standing-table",
  sport_team: "team-roster",
  sport_trainings: "training-schedule",
  sport_visitor_arrivals: "visitor-arrivals",
  sport_volunteers: "volunteer-call"
} as const satisfies Record<FieldFlowSlideType, string>;

export const fieldflowNewsVariants = [
  "hero_split",
  "fullscreen_gradient",
  "news_grid",
  "text_only"
] as const;

export const fieldflowMenuBlockTypes = [
  "category",
  "product-group",
  "image",
  "video",
  "logo",
  "text",
  "promo"
] as const;

export const fieldflowLedMomentKeys = [
  "goalOwn",
  "goalOpponent",
  "goalUnknown",
  "lineupHome",
  "lineupAway",
  "matchStart",
  "halfTime",
  "matchEnd"
] as const;

export const fieldflowSponsorPositions = [
  "fullscreen",
  "presented_by",
  "footer",
  "corner",
  "match_sponsor",
  "match_ball_sponsor"
] as const;
