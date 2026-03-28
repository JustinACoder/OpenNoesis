// Docs: https://developers.cloudflare.com/images/transform-images
export default function cloudflareLoader({ src, width, quality }) {
  const params = [
    `width=${width}`,
    `quality=${quality || 75}`,
    "format=webp",
    "fit=scale-down",
    "anim=false",
  ];
  const normalizedParams = params.join(",");

  if (URL.canParse(src)) {
    const srcUrl = new URL(src);
    const normalizedPath = srcUrl.pathname.replace(/^\/+/, "");
    return `${srcUrl.origin}/cdn-cgi/image/${normalizedParams}/${normalizedPath}`;
  }

  const normalizedPath = src.replace(/^\/+/, "");
  return `/cdn-cgi/image/${normalizedParams}/${normalizedPath}`;
}
