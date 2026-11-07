/** A shared runtime improvement for saved and new approved birthday slides.
 * The canonical six positions, source facts and frozen reference CSS stay intact. */
const birthday = '.ot-approved-frame .screen .birthday-grid.fixed-six-grid[data-grid-kind="birthdays"]';
const rule = (selector: string, declarations: string) => `${birthday} ${selector}{${declarations}}`;

export const syncOnzeTrotsBirthdayCss = [
  rule('.birthday-card', '--ot-birthday-name-size:56px;padding:22px 24px;gap:12px;justify-content:flex-start'),
  rule('.birthday-card[data-has-age]', '--ot-birthday-name-size:44px'),
  rule('.birthday-card .birthday-card-header', 'min-height:30px;align-items:center;gap:12px'),
  rule('.birthday-card .birthday-card-header>span', 'font:800 20px/1.4 OTManrope,Arial,sans-serif;letter-spacing:0;text-align:left;overflow-wrap:anywhere'),
  rule('.birthday-card .birthday-copy', 'display:flex;flex-direction:column;justify-content:center;gap:12px;flex:1 1 auto;min-height:0;min-width:0;width:100%'),
  rule('.birthday-card .birthday-name', 'flex:none;min-width:0;width:100%;margin:0;font-size:var(--ot-birthday-name-size);line-height:1.12;letter-spacing:0;overflow-wrap:anywhere'),
  rule('.birthday-card .birthday-greeting', 'display:block;font-size:18px;line-height:1.4;margin-bottom:10px;color:var(--dim)'),
  rule('.birthday-card .birthday-person', 'display:block;min-width:0;overflow-wrap:anywhere'),
  rule('.birthday-card .birthday-meta', 'flex:none;margin:0;font:600 18px/1.4 OTManrope,Arial,sans-serif;color:var(--dim);overflow-wrap:anywhere'),
  rule('.birthday-card .birthday-age-block', 'flex:0 0 auto;flex-direction:row;align-items:center;justify-content:center;align-self:center;gap:8px;width:auto;min-height:0;padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--row)'),
  rule('.birthday-card .birthday-age', 'font:800 32px/1 OTManrope,Arial,sans-serif;letter-spacing:0;color:var(--ot-accent-ink,var(--blue));grid-row:auto'),
  rule('.birthday-card .birthday-age-block>span', 'font:800 13px/1.3 OTManrope,Arial,sans-serif;letter-spacing:1px;margin:0;align-self:center'),
  '.ot-approved-frame .screen.portrait .birthday-grid.fixed-six-grid[data-grid-kind="birthdays"] .birthday-card{--ot-birthday-name-size:44px;padding:22px 16px}',
].join('\n');
