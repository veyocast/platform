export function slideComposerErrorPath(slideType: string, message: string) {
  const params = new URLSearchParams();
  if (slideType === "news") params.set("family", "news");
  params.set("fout", message);
  return `/dashboard/slides/new?${params.toString()}`;
}
