import { FileText, Globe, MessageSquareText } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field } from "@/components/field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONNAIRE } from "@/lib/questionnaire";
import type { ProfileSource } from "@/lib/types";
import { addUrlSource, deleteSource, saveQuestionnaire } from "../actions";
import { FileUpload } from "./file-upload";

const ICONS = { url: Globe, file: FileText, questionnaire: MessageSquareText } as const;

function parseQuestionnaire(text: string | null): Record<string, string> {
  if (!text) return {};
  const out: Record<string, string> = {};
  for (const block of text.split("\n\n")) {
    const m = block.match(/^Q: (.*)\nA: ([\s\S]*)$/);
    const q = m && QUESTIONNAIRE.find((x) => x.label === m[1]);
    if (q && m) out[q.key] = m[2];
  }
  return out;
}

export function SourcesTab({ profileId, sources }: { profileId: string; sources: ProfileSource[] }) {
  const questionnaire = sources.find((s) => s.kind === "questionnaire");
  const answers = parseQuestionnaire(questionnaire?.extracted_text ?? null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
            <CardDescription>Everything Polaris may use to describe this profile. Nothing else is used.</CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources yet. Add a link, a file or answer the questionnaire.</p>
            ) : (
              <ul className="divide-y">
                {sources.map((s, i) => {
                  const Icon = ICONS[s.kind];
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-6 text-xs tabular-nums text-muted-foreground">S{i + 1}</span>
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        {s.kind === "url" ? (
                          <a href={s.location} target="_blank" rel="noreferrer" className="block truncate text-sm hover:underline">
                            {s.title ? `${s.title} · ` : ""}
                            {s.location.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <div className="truncate text-sm">{s.title ?? s.location}</div>
                        )}
                        {s.status === "failed" && <div className="text-xs text-destructive">{s.error}</div>}
                      </div>
                      <ConfirmSubmit action={deleteSource.bind(null, profileId, s.id)} label="Remove" confirmLabel="Remove" size="xs" />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a link</CardTitle>
            <CardDescription>Portfolio, press coverage, case studies, media kit pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={addUrlSource.bind(null, profileId)} resetOnSuccess className="space-y-4">
              <Field id="url" label="Web address">
                <Input id="url" name="url" inputMode="url" required placeholder="northlight.studio/work" />
              </Field>
              <Field id="title" label="Label (optional)">
                <Input id="title" name="title" placeholder="Case studies" />
              </Field>
              <SubmitButton pendingLabel="Adding…">Add link</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload a file</CardTitle>
            <CardDescription>PDF, .txt or .md, up to 10 MB. Media kits and credentials decks work well.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload profileId={profileId} />
          </CardContent>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Owner questionnaire</CardTitle>
          <CardDescription>
            Fills gaps the website does not cover. Answers are stored as one source and replaced when you save again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={saveQuestionnaire.bind(null, profileId)} className="space-y-5">
            {QUESTIONNAIRE.map((q) => (
              <Field key={q.key} id={q.key} label={q.label}>
                <Textarea id={q.key} name={q.key} rows={3} defaultValue={answers[q.key] ?? ""} />
              </Field>
            ))}
            <SubmitButton>Save answers</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
