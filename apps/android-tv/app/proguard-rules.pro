# The app intentionally exposes no JavaScript interfaces.
#
# Keep the background-launch boundary as named production bytecode. Besides
# preventing an optimizer from folding away the verification contract, the
# release workflow can then prove that the exact policy and verifier shipped.
-keep class nl.veyocast.player.AutomationActivityLauncher { *; }
-keep class nl.veyocast.player.AutomationLaunchVerifier { *; }
