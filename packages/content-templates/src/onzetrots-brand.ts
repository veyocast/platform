/** Runtime brand rules apply to every saved OnzeTrots visual revision. Content,
 * provider facts and immutable publication identities remain the render input. */
export const ONZETROTS_PRIMARY = "#03438A";
export const ONZETROTS_HEADER_FONT_FAMILY = "OTMarker";
export const ONZETROTS_HEADER_FONT_PATH = "/onzetrots-approved-v1/assets/fonts/club-font-9.ttf";

export const ONZETROTS_FONT_FACE_CSS = `@font-face{font-family:${ONZETROTS_HEADER_FONT_FAMILY};src:url('${ONZETROTS_HEADER_FONT_PATH}') format('truetype');font-weight:400;font-style:normal;font-display:swap}`;

const sourceScopes = [".ot-approved-scope .screen", ".ot-v9-scope .screen"];
const headerRoles = ["h1", "h2", "h3", "h4", ".welcome-text", ".goal-word", ".birthday-name", ".sponsor-thanks", ".visitor-copy>span", ".vm-menu-slogan"];
const headerRules = `font-family:${ONZETROTS_HEADER_FONT_FAMILY},cursive!important;font-weight:400!important;font-style:normal!important;font-synthesis:none`;

export const ONZETROTS_SOURCE_BRAND_CSS = `${ONZETROTS_FONT_FACE_CSS}
${sourceScopes.join(",")}{--ot-brand-primary:${ONZETROTS_PRIMARY};--blue:${ONZETROTS_PRIMARY}!important;--ot-accent-ink:${ONZETROTS_PRIMARY};--ot-title-font:${ONZETROTS_HEADER_FONT_FAMILY},cursive}
${sourceScopes.map(scope => `${scope}[data-theme=dark]`).join(",")}{--ot-accent-ink:var(--ink,#f1f5ff)}
${sourceScopes.flatMap(scope => headerRoles.map(role => `${scope} ${role}`)).join(",")}{${headerRules}}
`;

/** The oldest Sync renderer already verifies/preloads this byte-identical
 * Permanent Marker face in its eleven-asset manifest. Keep that wire profile. */
export const ONZETROTS_LEGACY_SOURCE_BRAND_CSS = `
.sync-slide-root .vc-slide-preview.is-trots{--ot-brand-primary:${ONZETROTS_PRIMARY}}
${["h1", "h2", "h3", "h4", ".vc-goal-word", ".vc-birthday-name"].map(role => `.sync-slide-root .vc-slide-preview.is-trots ${role}`).join(",")}{font-family:'OnzeTrots Brush',cursive!important;font-weight:400!important;font-style:normal!important;font-synthesis:none}
`;
