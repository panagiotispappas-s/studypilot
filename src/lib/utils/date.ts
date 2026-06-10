export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDate(value?: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
