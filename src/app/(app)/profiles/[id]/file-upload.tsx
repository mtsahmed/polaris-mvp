"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { prepareUpload, registerUploadedFile } from "../actions";

// Uploads straight from the browser to Supabase Storage (avoids server body-size limits),
// then asks the server to register the file as a source.
export function FileUpload({ profileId }: { profileId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return setError("Choose a file to upload.");
    setBusy(true);
    setError(null);
    try {
      const target = await prepareUpload(profileId, file.name, file.size, file.type);
      if ("error" in target) throw new Error(target.error);

      const { error: uploadError } = await createClient()
        .storage.from("profile-uploads")
        .upload(target.path, file, { contentType: target.contentType, upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const result = await registerUploadedFile(profileId, target.path, file.name);
      if (result.error) throw new Error(result.error);

      toast.success(result.message ?? "Uploaded.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        aria-label="File"
        onChange={() => setError(null)}
      />
      <Button type="button" variant="gradient-outline" onClick={upload} disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
