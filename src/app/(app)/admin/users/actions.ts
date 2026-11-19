"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppAdmin, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type DeleteUserState = {
  error?: string;
  done?: { email: string; deleted: string[]; transferred: { workspace: string; to: string }[] };
};

const input = z.object({
  userId: z.uuid(),
  confirm: z.string().trim().min(1, "Type the user's email to confirm."),
});

// Deletes a user and their data. The database function re-checks that the caller is a Polaris app
// admin, that the typed email matches, and refuses self-deletion and other app admins
// (supabase/migrations/20261127000000_delete_users.sql).
export async function deleteUser(_prev: DeleteUserState, formData: FormData): Promise<DeleteUserState> {
  const session = await requireSession();
  if (!(await isAppAdmin())) return { error: "Only Polaris app admins can delete users." };
  const parsed = input.safeParse({ userId: formData.get("userId"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.userId === session.userId) return { error: "You cannot delete your own account here." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_delete_user", {
    target: parsed.data.userId,
    confirm_email: parsed.data.confirm,
  });
  if (error) return { error: error.message };

  const result = data as {
    email: string;
    deleted: { workspace: string }[];
    transferred: { workspace: string; to: string }[];
  };
  revalidatePath("/admin/users");
  revalidatePath("/usage");
  return {
    done: {
      email: result.email,
      deleted: result.deleted.map((d) => d.workspace),
      transferred: result.transferred,
    },
  };
}
