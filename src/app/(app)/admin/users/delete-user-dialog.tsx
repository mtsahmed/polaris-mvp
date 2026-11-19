"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUser, type DeleteUserState } from "./actions";

export type WorkspaceLine = { name: string; role: string; members: number };

// Typing the user's exact email unlocks the delete button (checked again in the database).
export function DeleteUserDialog({
  userId,
  email,
  name,
  workspaces,
}: {
  userId: string;
  email: string;
  name: string;
  workspaces: WorkspaceLine[];
}) {
  const [state, action, pending] = useActionState<DeleteUserState, FormData>(deleteUser, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();
  const alone = workspaces.filter((w) => w.members <= 1);
  const shared = workspaces.filter((w) => w.members > 1);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" title={`Delete ${email}`} className="text-destructive hover:text-destructive">
            <Trash2 />
            <span className="sr-only">Delete {email}</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        {state.done ? (
          <>
            <DialogHeader>
              <DialogTitle>User deleted</DialogTitle>
              <DialogDescription>{state.done.email} can no longer sign in.</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {state.done.deleted.map((w) => (
                <li key={w}>Workspace <span className="font-semibold">{w}</span> deleted with everything in it.</li>
              ))}
              {state.done.transferred.map((t) => (
                <li key={t.workspace}>
                  Work in <span className="font-semibold">{t.workspace}</span> transferred to {t.to}.
                </li>
              ))}
              {state.done.deleted.length + state.done.transferred.length === 0 && <li>They had no workspace data.</li>}
            </ul>
          </>
        ) : (
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Delete {name}?</DialogTitle>
              <DialogDescription>This permanently deletes the account. It cannot be undone.</DialogDescription>
            </DialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {alone.map((w) => (
                <li key={w.name}>
                  <span className="font-semibold">{w.name}</span> has no other members, so it is deleted with all its
                  profiles, companies, contacts, pitches and usage records.
                </li>
              ))}
              {shared.map((w) => (
                <li key={w.name}>
                  In <span className="font-semibold">{w.name}</span> ({w.members} members) everything they created,
                  approved or sent is transferred to the workspace owner. Their usage records stay, shown as
                  &ldquo;Deleted user&rdquo;.
                </li>
              ))}
              {workspaces.length === 0 && <li>They belong to no workspace.</li>}
            </ul>
            <input type="hidden" name="userId" value={userId} />
            <div className="space-y-2">
              <Label htmlFor={`confirm-${userId}`}>
                Type <span className="font-semibold">{email}</span> to confirm
              </Label>
              <Input
                id={`confirm-${userId}`}
                name="confirm"
                autoComplete="off"
                placeholder={email}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="h-10"
              />
            </div>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={!matches || pending}>
                <Trash2 /> {pending ? "Deleting…" : "Delete user"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
