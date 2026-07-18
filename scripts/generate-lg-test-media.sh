#!/usr/bin/env bash
set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "FFmpeg is vereist. Installeer FFmpeg 6 of nieuwer en voer dit script opnieuw uit." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "${script_dir}/.." && pwd)"
output_dir="${repo_dir}/apps/player/public/device-lab-media"

mkdir -p "${output_dir}"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 \
  -q:v 3 "${output_dir}/image-1920x1080.jpg"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 \
  "${output_dir}/image-1920x1080.png"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=0xFF6B0080:size=1920x1080:rate=1,format=rgba" -frames:v 1 \
  "${output_dir}/image-transparent.png"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1920x1080:rate=1" -frames:v 1 \
  -c:v libwebp -quality 82 "${output_dir}/image-1920x1080.webp"

generate_h264_with_audio() {
  local size="$1" rate="$2" profile="$3" level="$4" bitrate="$5" output="$6"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=${size}:rate=${rate}" \
    -f lavfi -i "sine=frequency=880:sample_rate=48000" \
    -t 4 -shortest \
    -c:v libx264 -profile:v "${profile}" -level:v "${level}" -pix_fmt yuv420p \
    -b:v "${bitrate}" -maxrate "${bitrate}" -bufsize "$(( ${bitrate%k} * 2 ))k" \
    -g "$((rate * 2))" -keyint_min "${rate}" -sc_threshold 0 \
    -c:a aac -profile:a aac_low -b:a 128k -ar 48000 \
    -movflags +faststart "${output_dir}/${output}"
}

generate_h264_with_audio 1280x720 25 baseline 3.1 900k h264-baseline-720p25-low.mp4
generate_h264_with_audio 1920x1080 30 main 4.0 3000k h264-main-1080p30-medium.mp4
generate_h264_with_audio 1920x1080 50 high 4.2 6500k h264-high-1080p50-high.mp4

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1920x1080:rate=60" -t 4 \
  -c:v libx264 -profile:v high -level:v 4.2 -pix_fmt yuv420p \
  -b:v 6500k -maxrate 6500k -bufsize 13000k -g 120 -keyint_min 60 -sc_threshold 0 \
  -an -movflags +faststart "${output_dir}/h264-high-1080p60-silent.mp4"

if [[ "${VEYOCAST_OPTIONAL_CODECS:-0}" == "1" ]]; then
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1280x720:rate=30" -t 4 \
    -c:v libvpx -b:v 1800k -an "${output_dir}/vp8-720p30.webm"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1920x1080:rate=30" -t 4 \
    -c:v libvpx-vp9 -b:v 3000k -an "${output_dir}/vp9-1080p30.webm"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=1920x1080:rate=30" -t 4 \
    -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p -b:v 3000k -an -movflags +faststart \
    "${output_dir}/hevc-1080p30.mp4"
fi

printf 'VEYOCAST_INTENTIONALLY_CORRUPT_MEDIA\n' > "${output_dir}/corrupt.mp4"

(
  cd "${output_dir}"
  sha256sum ./* > SHA256SUMS.txt
)

cat > "${output_dir}/README.txt" <<'EOF'
Generated, synthetic VeyoCast Device Capability Lab media.
Source: FFmpeg lavfi testsrc2/color/sine; no third-party visual or audio content.
Regenerate with: scripts/generate-lg-test-media.sh
Optional VP8/VP9/HEVC: VEYOCAST_OPTIONAL_CODECS=1 scripts/generate-lg-test-media.sh
EOF

echo "Testmedia gegenereerd in ${output_dir}"
