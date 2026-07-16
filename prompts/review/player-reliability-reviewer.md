# Player Reliability Reviewer Prompt

Review player changes.

Block if:

- playback depends on network when cached release exists;
- incomplete pending release can become active;
- corrupt asset causes black screen;
- video playback lacks muted/default handling;
- cache keys are not version/hash based;
- diagnostics leak sensitive data;
- browser chrome/cursor/media controls are visible in normal playback;
- no tests cover offline/restart/corrupt asset.
