-- Additive protocol kind. Historical image/video releases keep their enum values.
alter type public.media_asset_kind add value if not exists 'composition';
