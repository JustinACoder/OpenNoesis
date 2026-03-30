import removeMarkdown from "remove-markdown";

export function markdownToPlainText(value: string): string {
  const plainText = removeMarkdown(value, {
    useImgAltText: false,
    gfm: true,
  });

  return plainText.replace(/\s+/g, " ").trim();
}
