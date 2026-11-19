"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace, type DeleteWorkspaceState } from "./actions";

// Typing the exact workspace name unlocks the delete button (checked again on the server).
export function DeleteWorkspaceForm({ workspaceName }: { workspaceName: string }) {
  const [state, action, pending] = useActionState<DeleteWorkspaceState, FormData>(deleteWorkspace, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === workspaceName;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="confirm">
          Type <span className="font-semibold">{workspaceName}</span> to confirm
        </Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          placeholder={workspaceName}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="h-10 max-w-md"
        />
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="destructive" size="lg" disabled={!matches || pending}>
        <Trash2 /> {pending ? "Deleting…" : "Delete workspace"}
      </Button>
    </form>
  );
}
