// Task names for POST /api/ai/[task]. Shared by the server and the browser.
export const AI_TASKS = [
  "profile-intelligence",
  "icp-draft",
  "discovery",
  "pitch-start",
  "pitch-research",
  "pitch-concepts",
  "pitch-email",
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export function isAiTask(value: string): value is AiTask {
  return (AI_TASKS as readonly string[]).includes(value);
}
