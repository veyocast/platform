begin;

select plan(4);

select is(
  private.sportlink_arrival_window_minutes(
    '{"minutesBefore":10000}'::jsonb,
    'minutesBefore',
    90
  ),
  10000,
  'arrival horizon accepts ten thousand minutes'
);

select is(
  private.sportlink_arrival_window_minutes(
    '{"minutesBefore":999999}'::jsonb,
    'minutesBefore',
    90
  ),
  60480,
  'arrival horizon fails safely at forty-two days'
);

select is(
  private.sportlink_arrival_window_minutes(
    '{"minutesAfter":-20}'::jsonb,
    'minutesAfter',
    30
  ),
  0,
  'negative arrival horizon fails safely at zero'
);

select is(
  private.sportlink_arrival_window_minutes(
    '{}'::jsonb,
    'minutesBefore',
    90
  ),
  90,
  'missing arrival horizon retains the compatible default'
);

select * from finish();

rollback;
