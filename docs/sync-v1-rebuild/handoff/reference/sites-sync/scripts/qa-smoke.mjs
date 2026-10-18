/**
 * Local React component smoke tests. No browser, network requests or HTTP listener.
 * Run from the project root: node scripts/qa-smoke.mjs
 * Focus a repaired DOM flow: node scripts/qa-smoke.mjs --dom-only --filter=tenant
 * Requires the project's existing vite, jsdom, react and react-dom dependencies.
 * These checks do not establish visual quality or real device/provider behavior.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { JSDOM, VirtualConsole } from 'jsdom';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const storageKey = 'veyocast-v1-design-lab-v3';
const domOnly = process.argv.includes('--dom-only');
const filterArg = process.argv.find(arg => arg.startsWith('--filter='));
const domFilter = filterArg ? new RegExp(filterArg.slice('--filter='.length), 'i') : null;
const virtualConsole = new VirtualConsole();
const domErrors = [];
virtualConsole.on('jsdomError', error => domErrors.push(error.message));
const dom = new JSDOM('<!doctype html><html><body><div id="qa-root"></div></body></html>', {
  url: 'https://veyocast.test/?design=sync&page=overview',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;
for (const key of ['window', 'document', 'navigator', 'location', 'history', 'localStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLVideoElement', 'Element', 'SVGElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'FileReader', 'File', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'window' ? window : window[key] });
}
window.scrollTo = () => {};
window.matchMedia = query => ({ matches: query.includes('prefers-reduced-motion'), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.ResizeObserver = globalThis.ResizeObserver;

// Import ReactDOM only after the DOM globals exist, so its event system detects DOM support.
const [{ default: React, act }, { renderToString }, { createRoot }] = await Promise.all([
  import('react'), import('react-dom/server'), import('react-dom/client'),
]);
const h = React.createElement;
const report = { ssr: { passed: 0, failed: 0 }, dom: { passed: 0, failed: 0 }, pure: { passed: 0, failed: 0 }, failures: [], warnings: [] };
const originalError = console.error;
console.error = (...args) => {
  const message = args.map(String).join(' ');
  if (!report.warnings.includes(message)) report.warnings.push(message);
};
let vite;
let mountedRoot;
let app;
let modules;
const routes = ['overview', 'content', 'playlists', 'planning', 'screens', 'sources', 'products', 'themes', 'sponsors', 'engage', 'team', 'support', 'billing', 'platform', 'marketing', 'mobile', 'coverage', 'studio'];
const familyMap = [
  ['sport_program', 'fixtures'], ['sport_results', 'results'], ['sport_standing', 'standings'],
  ['sport_period_standing', 'period-standings'], ['sport_match_of_the_day', 'matchday'],
  ['sport_next_match', 'next-match'], ['sport_cancellations', 'cancellations'],
  ['sport_dressing_rooms', 'dressing-rooms'], ['sport_officials', 'officials'],
  ['sport_team', 'team-info'], ['sport_sponsor', 'sponsors'], ['sport_activities', 'activities'],
  ['sport_trainings', 'training'], ['sport_volunteers', 'volunteers'], ['sport_birthdays', 'birthdays'],
  ['sport_visitor_arrivals', 'visitors'], ['sport_referee_arrivals', 'referees'],
];

function setLocation({ design = 'sync', route = 'overview', id, poll } = {}) {
  const params = new URLSearchParams({ design, page: route });
  if (id) params.set('id', id);
  if (poll) params.set('poll', poll);
  history.replaceState(null, '', `/?${params}`);
}
function fixture(patch) {
  const data = structuredClone(modules.store.seed);
  patch?.(data);
  return data;
}
function prepare(location, data) {
  localStorage.clear();
  setLocation(location);
  localStorage.setItem(storageKey, JSON.stringify(data || fixture()));
}
function recordFailure(kind, name, error) {
  report[kind].failed += 1;
  report.failures.push({ kind, name, message: error.message, stack: error.stack?.split('\n').slice(1, 5).join('\n') });
  process.stdout.write(`FAIL ${kind}: ${name}: ${error.message}\n`);
}
function ssr(name, { location, data, component, contains } = {}) {
  try {
    prepare(location, data);
    const markup = renderToString(h(modules.store.AppProvider, null, component || h(modules.App)));
    assert.ok(markup.length > 300, 'render produced no substantive markup');
    assert.ok(!/Invalid Date|NaN%|NaN seconden/.test(markup), 'invalid date or NaN visible in initial render');
    if (contains) assert.ok(markup.includes(contains), `missing expected render marker: ${contains}`);
    report.ssr.passed += 1;
  } catch (error) { recordFailure('ssr', name, error); }
}
function Probe() { app = modules.store.useApp(); return null; }
function TestRouter() {
  const state = modules.store.useApp();
  const { route, selectedId } = state;
  const component = route === 'content' ? modules.content.ContentPage
    : route === 'studio' ? modules.content.StudioPage
    : route === 'playlists' ? modules.playlists.PlaylistsPage
    : route === 'screens' ? modules.players.ScreensPage
    : route === 'planning' ? modules.players.PlanningPage
    : null;
  return h(React.Fragment, null, h(Probe), component ? h(component, { key: route + ':' + (selectedId || '') }) : h(modules.admin.AdminPage, { section: route }));
}
async function cleanup() {
  if (mountedRoot) {
    await act(async () => mountedRoot.unmount());
    mountedRoot = null;
  }
  document.getElementById('qa-root').replaceChildren();
}
async function mount(location, data, child) {
  await cleanup();
  prepare(location, data);
  mountedRoot = createRoot(document.getElementById('qa-root'));
  await act(async () => mountedRoot.render(h(modules.store.AppProvider, null, h(Probe), child || h(TestRouter))));
}
const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
function button(text, scope = document) {
  const matches = [...scope.querySelectorAll('button')].filter(el => normalized(el.textContent) === text || el.getAttribute('aria-label') === text);
  assert.ok(matches.length, `button not found: ${text}`);
  return matches.find(el => !el.disabled) || matches[0];
}
function field(label, scope = document) {
  const direct = [...scope.querySelectorAll('input,select,textarea')].find(el => el.getAttribute('aria-label') === label);
  if (direct) return direct;
  const match = [...scope.querySelectorAll('label')].find(el => normalized(el.querySelector('span')?.textContent) === label);
  assert.ok(match, `field not found: ${label}`);
  const input = match.querySelector('input,select,textarea');
  assert.ok(input, `input missing for: ${label}`);
  return input;
}
async function click(el) {
  assert.ok(el, 'click target missing');
  assert.ok(!el.disabled, `button disabled: ${normalized(el.textContent)}`);
  await act(async () => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
}
async function fill(el, value) {
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
}
async function navigate(route, id) { await act(async () => app.go(route, id)); }
async function test(name, fn, kind = 'dom') {
  if (domFilter && !domFilter.test(name)) return;
  try {
    await fn();
    report[kind].passed += 1;
    process.stdout.write(`PASS ${kind}: ${name}\n`);
  } catch (error) { recordFailure(kind, name, error); }
  finally { await cleanup(); }
}
async function confirmPublication({ scheduled = false } = {}) {
  await click(button('Kies de bestemming'));
  await click(button('Alle schermen'));
  if (scheduled) {
    await fill(field('Wanneer'), 'schedule');
    await fill(document.querySelector('input[type="datetime-local"]'), '2030-10-17T18:00');
  }
  await click(button('Publicatie bevestigen'));
  await fill(field('MFA code'), '123456');
  await click(button('Bevestig'));
}

try {
  vite = await createServer({
    root: rootDir,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, entries: [] },
  });
  assert.equal(vite.httpServer, null, 'QA must not start an HTTP listener');
  const [store, appModule, content, playlists, players, admin] = await Promise.all([
    vite.ssrLoadModule('/src/store.tsx'), vite.ssrLoadModule('/src/App.tsx'),
    vite.ssrLoadModule('/src/modules/Content.tsx'), vite.ssrLoadModule('/src/modules/Playlists.tsx'),
    vite.ssrLoadModule('/src/modules/Players.tsx'), vite.ssrLoadModule('/src/modules/Admin.tsx'),
  ]);
  modules = { store, App: appModule.default, content, playlists, players, admin };

  if (!domOnly) {
  for (const { id: design } of store.designs) {
    for (const route of routes) ssr(`${design}/${route}`, { location: { design, route }, contains: `design-${design}` });
    for (const [route, id] of [['studio', 'c1'], ['screens', 's1'], ['playlists', 'p1']]) {
      ssr(`${design}/${route}/${id}`, { location: { design, route, id }, contains: `design-${design}` });
    }
    for (const [contract, family] of familyMap) {
      for (const orientation of ['16:9', '9:16']) {
        const data = fixture(d => d.content.unshift({ ...structuredClone(d.content[0]), id: 'qa-family', title: `QA ${family}`, family, orientation }));
        ssr(`${design}/studio/${contract}/${orientation}`, { location: { design, route: 'studio', id: 'qa-family' }, data, contains: 'QA ' + family });
      }
    }
  }
  for (const screen of store.seed.screens) ssr(`player/${screen.id}/${screen.status}`, { component: h(players.PlayerExperience, { screenId: screen.id }) });
  ssr('marketing homepage', { location: { design: '' } });
  const empty = fixture(d => {
    for (const key of ['content', 'playlists', 'screens', 'sources', 'products', 'campaigns', 'sponsors', 'polls', 'tickets', 'schedule', 'releases', 'audit', 'notifications']) d[key] = [];
    d.settings.tenantName = 'Lege QA-organisatie';
  });
  for (const route of routes) ssr(`empty/${route}`, { location: { route }, data: empty });
  process.stdout.write(`SSR: ${report.ssr.passed} passed, ${report.ssr.failed} failed (Sync design, 18 routes, details, 17 families in both orientations, players, empty states).\n`);
  }

  await test('price publication freezes changed rows and preserves confirmed release', async () => {
    const data = fixture();
    const beforeReleases = structuredClone(data.releases);
    const beforeScreens = structuredClone(data.screens);
    const menu = data.content.find(c => c.family === 'menu');
    const product = data.products.find(p => p.name === menu.settings.rows[0].name);
    const changedPrice = 4.75;
    product.price = changedPrice;
    data.settings.menuPriceSnapshot[product.id] = changedPrice;
    const frozen = store.freezeContent(data, menu);
    assert.equal(frozen.settings.rows[0].productId, product.id);
    assert.equal(frozen.settings.rows[0].price, changedPrice);
    assert.notEqual(menu.settings.rows[0].price, changedPrice, 'freezing must not mutate the source design');
    const newVersions = store.publishPriceReleases(data);
    assert.ok(newVersions.length > 0, 'price publication did not create a release');
    for (const previous of beforeReleases) assert.deepEqual(data.releases.find(r => r.id === previous.id), previous, 'historical release changed');
    for (const screen of data.screens) {
      const previous = beforeScreens.find(s => s.id === screen.id);
      assert.equal(screen.confirmedVersion, previous.confirmedVersion, 'price publication changed confirmed output');
      const playlist = data.playlists.find(p => p.id === screen.playlistId);
      const usesMenu = playlist.items.some(i => data.content.find(c => c.id === i.contentId)?.family === 'menu');
      if (usesMenu) {
        assert.ok(newVersions.includes(screen.desiredVersion), 'desired version is not a newly published release');
        const release = data.releases.find(r => r.id === screen.desiredVersion);
        assert.ok(release, 'desired version references a nonexistent release');
        assert.equal(release.contentSnapshots.find(c => c.id === menu.id).settings.rows.find(r => r.productId === product.id).price, changedPrice);
      } else assert.equal(screen.desiredVersion, previous.desiredVersion, 'unrelated screen assignment changed');
    }
    product.price = 99;
    data.settings.menuPriceSnapshot[product.id] = 99;
    for (const id of newVersions) assert.equal(data.releases.find(r => r.id === id).contentSnapshots.find(c => c.id === menu.id).settings.rows.find(r => r.productId === product.id).price, changedPrice, 'new release retained a mutable catalog reference');
  }, 'pure');

  await test('create/save content → create playlist → add → publish → immutable release', async () => {
    await mount({ route: 'content' });
    const oldCount = app.data.content.length;
    await click(button('Nieuw ontwerp'));
    const template = [...document.querySelectorAll('.vc-template-card')].find(el => el.querySelector(':scope > span > strong')?.textContent === 'Vrij ontwerp');
    await click(template);
    assert.equal(app.route, 'studio');
    const contentId = app.selectedId;
    await fill(field('Ontwerpnaam'), 'QA clubbericht');
    await click(button('Opslaan'));
    assert.equal(app.data.content.length, oldCount + 1);
    assert.equal(app.data.content.find(c => c.id === contentId).status, 'ready');
    await navigate('playlists');
    await click(button('Nieuwe playlist'));
    await fill(field('Naam'), 'QA uitzending');
    await click(button('Playlist aanmaken'));
    const playlistId = app.selectedId;
    await click(button('Content toevoegen'));
    await click([...document.querySelectorAll('.picker-item')].find(el => el.querySelector(':scope > strong')?.textContent === 'QA clubbericht'));
    await click(button('Toevoegen aan playlist'));
    assert.equal(app.data.playlists.find(p => p.id === playlistId).items[0].contentId, contentId);
    const oldConfirmed = Object.fromEntries(app.data.screens.map(s => [s.id, s.confirmedVersion]));
    await click(button('Publiceren'));
    await confirmPublication();
    const release = app.data.releases[0];
    assert.equal(release.playlistId, playlistId);
    assert.equal(release.contentSnapshots[0].title, 'QA clubbericht');
    for (const screen of app.data.screens) assert.equal(screen.confirmedVersion, oldConfirmed[screen.id], 'publishing must not imply visible confirmation');
    const failureSwitch = document.querySelector('[role="switch"][aria-label="Simuleer een download- of verificatiefout"]');
    await click(failureSwitch);
    await click(button('Veilige fallback behouden'));
    for (const screen of app.data.screens) assert.equal(screen.confirmedVersion, oldConfirmed[screen.id], 'failed verification changed active release');
    await click(failureSwitch);
    for (let n = 0; n < 4; n += 1) await click(button(n === 3 ? 'Simuleer veilige activatie' : 'Volgende apparaatstap'));
    for (const screen of app.data.screens) assert.equal(screen.confirmedVersion, screen.status === 'online' ? release.id : oldConfirmed[screen.id]);
    await navigate('studio', contentId);
    await fill(field('Ontwerpnaam'), 'Gewijzigd concept na publicatie');
    await click(button('Opslaan'));
    assert.equal(app.data.releases.find(r => r.id === release.id).contentSnapshots[0].title, 'QA clubbericht');
    assert.equal(JSON.parse(localStorage.getItem(storageKey)).content.find(c => c.id === contentId).title, 'Gewijzigd concept na publicatie');
  });

  await test('scheduled publication preserves default/desired assignments', async () => {
    await mount({ route: 'playlists', id: 'p3' });
    const before = app.data.screens.map(s => ({ id: s.id, playlistId: s.playlistId, desiredVersion: s.desiredVersion, confirmedVersion: s.confirmedVersion }));
    const scheduleCount = app.data.schedule.length;
    await click(button('Publiceren'));
    await confirmPublication({ scheduled: true });
    assert.equal(app.data.schedule.length, scheduleCount + 1);
    assert.deepEqual(app.data.screens.map(s => ({ id: s.id, playlistId: s.playlistId, desiredVersion: s.desiredVersion, confirmedVersion: s.confirmedVersion })), before);
    assert.ok(app.data.schedule.at(-1).releaseId, 'planned publication should reference its exact release');
  });

  await test('processing content is blocked by publication preflight', async () => {
    const data = fixture(d => { d.content.find(c => c.id === 'c1').status = 'processing'; });
    await mount({ route: 'playlists', id: 'p1' }, data);
    await click(button('Publiceren'));
    assert.equal(button('Kies de bestemming').disabled, true);
  });

  await test('Viewer cannot mutate content through actual create action', async () => {
    await mount({ route: 'content' }, fixture(d => { d.settings.sessionRole = 'Viewer'; }));
    const before = JSON.stringify(app.data.content);
    const create = button('Nieuw ontwerp');
    if (!create.disabled) {
      await click(create);
      const template = [...document.querySelectorAll('.vc-template-card')].find(el => el.querySelector(':scope > span > strong')?.textContent === 'Vrij ontwerp');
      if (template && !template.disabled) await click(template);
    }
    assert.equal(JSON.stringify(app.data.content), before);
  });

  await test('tenant switch keeps content separate and empty sources empty', async () => {
    await mount({ route: 'content' });
    const firstContent = JSON.stringify(app.data.content);
    await act(async () => app.switchTenant('tenant2'));
    assert.equal(app.data.settings.tenantId, 'tenant2');
    assert.equal(app.data.content.length, 1);
    await navigate('sources');
    assert.equal(app.data.sources.length, 0, 'empty organization was reseeded with another club sources');
    await act(async () => app.switchTenant('tenant1'));
    assert.equal(JSON.stringify(app.data.content), firstContent);
  });

  await test('Engage deep link opens intended vote and prevents repeat vote', async () => {
    const data = fixture(d => { d.polls[0].status = 'live'; d.polls[0].visibility = 'live'; });
    await mount({ route: 'engage', poll: 'poll1' }, data);
    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog, 'poll deep link did not open voting dialog');
    const option = data.polls[0].options[0];
    const target = [...dialog.querySelectorAll('button')].find(el => normalized(el.textContent).includes(option.label));
    await click(target);
    assert.equal(app.data.polls[0].options[0].votes, option.votes + 1);
    const retry = [...document.querySelectorAll('[role="dialog"] button')].find(el => normalized(el.textContent).includes(option.label));
    if (retry && !retry.disabled) await click(retry);
    assert.equal(app.data.polls[0].options[0].votes, option.votes + 1);
  });
} catch (error) {
  recordFailure('dom', 'harness setup', error);
} finally {
  await cleanup();
  await vite?.close();
  dom.window.close();
  console.error = originalError;
}
report.warnings.push(...domErrors.filter(message => !report.warnings.includes(message)));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.stdout.write('Scope: component rendering and local React state only; no browser layout, hardware, payments or live provider assertions.\n');
process.exitCode = report.ssr.failed + report.dom.failed + report.pure.failed ? 1 : 0;
