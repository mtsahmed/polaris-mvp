"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { AUTO_MODEL, findModel, MODEL_CATALOG, type CatalogProvider } from "@/lib/ai/models";

const PROVIDER_ENV: Record<CatalogProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export function ModelPicker({
  value,
  setModel,
  configured,
}: {
  value: string;
  setModel: (formData: FormData) => Promise<void>;
  configured: Record<CatalogProvider, boolean>;
}) {
  const [pending, startTransition] = useTransition();
  const choice = findModel(value);
  const note = choice
    ? configured[choice.provider]
      ? choice.model.note
      : `Needs ${PROVIDER_ENV[choice.provider]} in .env.local.`
    : "Claude Opus 5.5 first; OpenAI only if Claude is unavailable.";

  return (
    <form
      action={setModel}
      className="relative rounded-2xl border border-sidebar-border bg-sidebar-accent/50 px-4 py-3"
    >
      <label
        htmlFor="model-picker"
        className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-[0.14em] text-gold"
      >
        <Sparkles className="size-3.5" aria-hidden="true" /> AI model
      </label>
      <select
        id="model-picker"
        name="model"
        defaultValue={value}
        disabled={pending}
        onChange={(e) => {
          const formData = new FormData(e.currentTarget.form!);
          startTransition(() => setModel(formData));
        }}
        className="mt-2 h-10 w-full rounded-xl border border-sidebar-border bg-sidebar px-3 text-[0.9375rem] font-medium text-sidebar-foreground [color-scheme:dark] outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 disabled:opacity-70"
      >
        <option value={AUTO_MODEL}>Auto (recommended)</option>
        {MODEL_CATALOG.map((group) => (
          <optgroup key={group.provider} label={group.label}>
            {group.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {configured[group.provider] ? "" : " (no API key)"}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="mt-1.5 text-xs leading-snug text-sidebar-foreground/70" aria-live="polite">
        {pending ? "Saving…" : note}
      </p>
      <noscript>
        <button type="submit" className="mt-2 text-sm underline">
          Save
        </button>
      </noscript>
    </form>
  );
}
