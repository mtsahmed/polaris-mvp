import { redirect } from "next/navigation";

// Pipeline was renamed Dashboard (owner review, 17 Nov 2026); old links still work.
export default function PipelinePage() {
  redirect("/dashboard");
}
