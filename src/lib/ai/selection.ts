import "server-only";
import { cookies } from "next/headers";
import { AUTO_MODEL, findModel, type ModelChoice } from "./models";

export const MODEL_COOKIE = "polaris_model";

// The model this browser picked in the sidebar, or null for Auto (Claude first, OpenAI fallback).
// Unknown values (for example a model removed from the catalog) count as Auto.
export async function selectedModel(): Promise<ModelChoice | null> {
  const store = await cookies();
  const value = store.get(MODEL_COOKIE)?.value;
  if (!value || value === AUTO_MODEL) return null;
  return findModel(value);
}

export async function selectedModelId(): Promise<string> {
  return (await selectedModel())?.model.id ?? AUTO_MODEL;
}
