"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AUTO_MODEL, findModel } from "@/lib/ai/models";
import { MODEL_COOKIE } from "@/lib/ai/selection";
import { requireSession } from "@/lib/session";

// Saves the AI model picked in the sidebar for this browser.
export async function setModel(formData: FormData) {
  await requireSession();
  const value = String(formData.get("model") ?? AUTO_MODEL);
  const store = await cookies();
  if (value === AUTO_MODEL || !findModel(value)) {
    store.delete(MODEL_COOKIE);
  } else {
    store.set(MODEL_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
}
