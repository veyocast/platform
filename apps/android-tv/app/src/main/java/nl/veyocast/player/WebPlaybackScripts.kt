package nl.veyocast.player

object WebPlaybackScripts {
    const val PAUSE_FOR_BACKGROUND = """
        (() => {
          document.querySelectorAll('video, audio').forEach((media) => {
            if (!media.paused && !media.ended) {
              media.dataset.veyocastNativeResume = '1';
              media.pause();
            }
          });
          return true;
        })()
    """

    const val RESUME_AFTER_BACKGROUND = """
        (() => {
          document.querySelectorAll('video[data-veyocast-native-resume="1"], audio[data-veyocast-native-resume="1"]')
            .forEach((media) => {
              delete media.dataset.veyocastNativeResume;
              media.play().catch(() => {});
            });
          return true;
        })()
    """

    fun command(command: PlaybackCommand): String {
        val demoNavigation = when (command) {
            PlaybackCommand.SEEK_BACKWARD -> """
                const demoPlayer = document.querySelector('[data-veyocast-demo-player="true"]');
                if (demoPlayer) {
                  window.dispatchEvent(new CustomEvent('veyocast:demo-navigate', {
                    detail: { direction: 'previous' }
                  }));
                  return true;
                }
            """.trimIndent()
            PlaybackCommand.SEEK_FORWARD -> """
                const demoPlayer = document.querySelector('[data-veyocast-demo-player="true"]');
                if (demoPlayer) {
                  window.dispatchEvent(new CustomEvent('veyocast:demo-navigate', {
                    detail: { direction: 'next' }
                  }));
                  return true;
                }
            """.trimIndent()
            else -> ""
        }
        val operation = when (command) {
            PlaybackCommand.TOGGLE -> """
                if (media.paused) media.play().catch(() => {}); else media.pause();
            """.trimIndent()
            PlaybackCommand.PLAY -> "media.play().catch(() => {});"
            PlaybackCommand.PAUSE -> "media.pause();"
            PlaybackCommand.SEEK_BACKWARD ->
                "media.currentTime = Math.max(0, media.currentTime - 10);"
            PlaybackCommand.SEEK_FORWARD -> """
                const end = Number.isFinite(media.duration) ? media.duration : media.currentTime + 10;
                media.currentTime = Math.min(end, media.currentTime + 10);
            """.trimIndent()
        }

        return """
            (() => {
              $demoNavigation
              const candidates = Array.from(document.querySelectorAll('video, audio'))
                .filter((candidate) =>
                  candidate.isConnected && !candidate.ended && candidate.getClientRects().length > 0
                );
              const media = candidates.find((candidate) => !candidate.paused) || candidates[0];
              if (!media) return false;
              $operation
              return true;
            })()
        """.trimIndent()
    }
}
