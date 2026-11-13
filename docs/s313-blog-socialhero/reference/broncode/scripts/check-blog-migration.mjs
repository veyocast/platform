import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(readFileSync(new URL("../drizzle/0000_blog.sql", import.meta.url), "utf8"));
const insert = db.prepare("INSERT INTO blog_entries (id, draft, live, draft_slug, live_slug, revision, updated_at, source) VALUES (?, '{}', '{}', ?, ?, 1, 'now', 'manual')");
insert.run("first", "eerste", "eerste");
insert.run("second", "tweede", "tweede");
db.prepare("UPDATE blog_entries SET draft_slug = ? WHERE id = ?").run("nieuw", "first");
assert.equal(db.prepare("SELECT live_slug FROM blog_entries WHERE id = 'first'").get().live_slug, "eerste");
db.prepare("UPDATE blog_entries SET live_slug = draft_slug WHERE id = ?").run("first");
assert.equal(db.prepare("SELECT entry_id FROM blog_redirects WHERE slug = 'eerste'").get().entry_id, "first");
assert.throws(() => insert.run("third", "eerste", "eerste"), /SLUG_CONFLICT/);
assert.throws(() => insert.run("fourth", "tweede", "tweede"), /SLUG_CONFLICT/);
console.log("Blog migration: draft isolation, permanent redirects and slug uniqueness passed.");
