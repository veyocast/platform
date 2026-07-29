const minimumMobileViewport = 320;
const minimumScreenPadding = 16;
const playlistCardPadding = 12;
const cardBorderWidth = 1;

export const playlistItemActionLayout = {
  deleteWidth: 90,
  fitWidth: 68,
  gap: 6,
  moveWidth: 91
} as const;

export const playlistItemActionRailWidth =
  playlistItemActionLayout.moveWidth +
  playlistItemActionLayout.fitWidth +
  playlistItemActionLayout.deleteWidth +
  playlistItemActionLayout.gap * 2;

export const minimumPlaylistItemCardContentWidth =
  minimumMobileViewport -
  minimumScreenPadding * 2 -
  playlistCardPadding * 2 -
  cardBorderWidth * 2;
