export type ActionState = { ok?: boolean; error?: string; message?: string; at?: number };

export const ok = (message?: string): ActionState => ({ ok: true, message, at: Date.now() });
export const fail = (error: string): ActionState => ({ ok: false, error, at: Date.now() });

// Textarea "one per line" → trimmed, de-duplicated list.
export function lines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split("\n").map((l) => l.trim()).filter(Boolean))];
}

export function text(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}
