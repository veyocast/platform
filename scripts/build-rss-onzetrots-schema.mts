import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = process.argv[2];
if (!file || !/^supabase\/migrations\/\d{14}_rss_onzetrots_layouts\.sql$/.test(file)) throw Error('Provide the new RSS forward migration.');
const original = readFileSync(file, 'utf8');
let updated = original;
for (const [marker, source] of [['sync_schema', 'sync-slide-json-schema.json'], ['sync_dynamic_schema', 'sync-dynamic-json-schema.json']]) {
  const tag = `$${marker}$`, start = updated.indexOf(tag), end = updated.indexOf(tag, start + tag.length);
  if (start < 0 || end < 0 || updated.indexOf(tag, end + tag.length) >= 0) throw Error('Expected unique schema markers.');
  updated = updated.slice(0, start + tag.length) + JSON.stringify(JSON.parse(readFileSync(`packages/contracts/src/${source}`, 'utf8'))) + updated.slice(end);
}
if (updated !== original) execFileSync('apply_patch', [], { input: `*** Begin Patch\n*** Update File: ${file}\n@@\n${original.trimEnd().split('\n').map(line => `-${line}`).join('\n')}\n${updated.trimEnd().split('\n').map(line => `+${line}`).join('\n')}\n*** End Patch\n`, stdio: ['pipe', 'inherit', 'inherit'] });
