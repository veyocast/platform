alter type public.media_asset_status
  add value if not exists 'quarantined' before 'deleted';
