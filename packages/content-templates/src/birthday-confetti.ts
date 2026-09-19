/** A bounded canvas inside a birthday card, between its photo and text.
 * No provider data, timers or DOM survive cleanup.
 * Kept self-contained so the trusted Static LG bundle uses this exact engine too.
 */
export function startBirthdayConfetti(host: HTMLElement, options: {
  colors: string[];
  reducedMotion?: boolean;
  particleLimit?: number;
}) {
  if (options.reducedMotion) return function () {};
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return function () {};
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("data-birthday-confetti", "active");
  canvas.style.cssText = "position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;pointer-events:none;z-index:-1";
  host.appendChild(canvas);
  const colors = options.colors.filter(Boolean);
  if (!colors.length) colors.push("#FFFFFF");
  const limit = Math.max(4, Math.min(56, options.particleLimit || 40));
  let count = limit;
  let frame = 0;
  let disposed = false;
  let last = 0;
  let measuredTime = 0;
  let measuredFrames = 0;
  let width = 1;
  let height = 1;
  let seed = 128;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const particles = Array.from({ length: limit }, function (_, index) { return {
    x: random(), y: -random() * 0.08, speed: 0.09 + random() * 0.09,
    drift: (random() - 0.5) * 0.055, size: 0.007 + random() * 0.006,
    angle: random() * 0.8, spin: (random() - 0.5) * 1.3,
    round: index % 4 === 0, color: colors[index % colors.length]!
  }; });
  function resize() {
    const rect = host.getBoundingClientRect();
    const scale = Math.min(1, 1440 / Math.max(1, rect.width, rect.height));
    width = Math.max(1, Math.round(rect.width * scale));
    height = Math.max(1, Math.round(rect.height * scale));
    canvas.width = width;
    canvas.height = height;
  }
  function draw(time: number) {
    if (disposed) return;
    const elapsed = last ? Math.max(0, time - last) : 16;
    last = time;
    const delta = Math.min(0.05, elapsed / 1000);
    measuredTime += elapsed;
    measuredFrames += 1;
    if (measuredTime >= 2000) {
      if (measuredTime / measuredFrames > 25) count = Math.max(4, Math.floor(count * 0.75));
      measuredTime = 0;
      measuredFrames = 0;
      canvas.setAttribute("data-particle-count", String(count));
    }
    context!.clearRect(0, 0, width, height);
    for (let index = 0; index < count; index += 1) {
      const p = particles[index]!;
      p.y += p.speed * delta;
      p.x += p.drift * delta;
      p.angle += p.spin * delta;
      if (p.y > 1.04) { p.y = -0.05; p.x = random(); }
      if (p.x < -0.03) p.x = 1.03;
      if (p.x > 1.03) p.x = -0.03;
      const size = Math.max(3, Math.min(width, height) * p.size);
      context!.save();
      context!.translate(p.x * width, p.y * height);
      context!.rotate(p.angle);
      context!.globalAlpha = 0.76;
      context!.fillStyle = p.color;
      if (p.round) {
        context!.beginPath();
        context!.arc(0, 0, size * 0.45, 0, Math.PI * 2);
        context!.fill();
      } else context!.fillRect(-size / 2, -size / 3, size, size * 0.65);
      context!.restore();
    }
    frame = window.requestAnimationFrame(draw);
  }
  resize();
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(host);
  window.addEventListener("resize", resize);
  frame = window.requestAnimationFrame(draw);
  return function () {
    if (disposed) return;
    disposed = true;
    window.cancelAnimationFrame(frame);
    if (observer) observer.disconnect();
    window.removeEventListener("resize", resize);
    canvas.remove();
    canvas.width = 0;
    canvas.height = 0;
  };
}
