import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
  disallowedTagsMode: "discard",
};

export function sanitizeText(input: string): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  return sanitizeHtml(trimmed, SANITIZE_OPTIONS);
}

export function sanitizeEmail(input: string): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}
