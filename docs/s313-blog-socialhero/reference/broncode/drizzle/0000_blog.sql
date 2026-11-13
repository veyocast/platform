CREATE TABLE `blog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`draft` text NOT NULL,
	`live` text,
	`draft_slug` text NOT NULL,
	`live_slug` text,
	`revision` integer NOT NULL,
	`published_revision` integer,
	`published_at` text,
	`published_updated_at` text,
	`updated_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_entries_draft_slug` ON `blog_entries` (`draft_slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `blog_entries_live_slug` ON `blog_entries` (`live_slug`);--> statement-breakpoint
CREATE TABLE `blog_redirects` (
	`slug` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `blog_entries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER `blog_entries_check_slug_insert` BEFORE INSERT ON `blog_entries`
WHEN EXISTS (SELECT 1 FROM blog_entries WHERE id <> NEW.id AND live_slug = NEW.draft_slug)
  OR EXISTS (SELECT 1 FROM blog_redirects WHERE entry_id <> NEW.id AND slug = NEW.draft_slug)
BEGIN SELECT RAISE(ABORT, 'SLUG_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `blog_entries_check_slug_update` BEFORE UPDATE OF draft_slug ON `blog_entries`
WHEN EXISTS (SELECT 1 FROM blog_entries WHERE id <> NEW.id AND live_slug = NEW.draft_slug)
  OR EXISTS (SELECT 1 FROM blog_redirects WHERE entry_id <> NEW.id AND slug = NEW.draft_slug)
BEGIN SELECT RAISE(ABORT, 'SLUG_CONFLICT'); END;
--> statement-breakpoint
CREATE TRIGGER `blog_entries_record_redirect` AFTER UPDATE OF live_slug ON `blog_entries`
WHEN OLD.live_slug IS NOT NULL AND NEW.live_slug IS NOT NULL AND OLD.live_slug <> NEW.live_slug
BEGIN INSERT OR IGNORE INTO blog_redirects (slug, entry_id) VALUES (OLD.live_slug, NEW.id); END;
