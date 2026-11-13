// The AI models a user can pick. Shared by the server (routing) and the browser (picker),
// so nothing here may import server-only code.

export type CatalogProvider = "anthropic" | "openai";

export type CatalogModel = {
  id: string; // exact API model id
  name: string; // shown in the picker
  note: string; // one-line hint shown under the picker
};

export const AUTO_MODEL = "auto";

export const MODEL_CATALOG: { provider: CatalogProvider; label: string; models: CatalogModel[] }[] = [
  {
    provider: "anthropic",
    label: "Anthropic: Claude",
    models: [
      { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "Fastest and lowest cost. $0.10 / $0.50 per M tokens." },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Balanced speed and quality. $2 / $10 per M tokens." },
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Most capable Claude model here. $4 / $20 per M tokens." },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", note: "Previous Sonnet generation. $2 / $10 per M tokens." },
      { id: "claude-opus-5", name: "Claude Opus 5", note: "Previous Opus generation. $5 / $25 per M tokens." },
    ],
  },
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-6-astra", name: "GPT 6 Astra", note: "Most capable OpenAI model here. $10 / $50 per M tokens." },
      { id: "gpt-6.1-sol", name: "GPT 6.1 Sol", note: "Strong all-rounder. $2 / $10 per M tokens." },
      { id: "gpt-6.1-terra", name: "GPT 6.1 Terra", note: "Lower cost. $1 / $5 per M tokens." },
      { id: "gpt-5.5", name: "GPT 5.5", note: "Previous generation. $5 / $30 per M tokens." },
      { id: "gpt-5.4", name: "GPT 5.4", note: "Older generation. $2.50 / $15 per M tokens." },
    ],
  },
];

export type ModelChoice = { provider: CatalogProvider; model: CatalogModel };

export function findModel(id: string | undefined | null): ModelChoice | null {
  if (!id) return null;
  for (const group of MODEL_CATALOG) {
    const model = group.models.find((m) => m.id === id);
    if (model) return { provider: group.provider, model };
  }
  return null;
}

export function modelDisplayName(id: string): string {
  return findModel(id)?.model.name ?? id;
}
