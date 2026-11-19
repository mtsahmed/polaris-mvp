// The privacy policy and terms are drafts until the owner has reviewed them (requested 19 November
// 2026). Set this to false once both are approved; the notice then disappears from both pages.
export const DRAFT = true;

export function DraftNotice() {
  if (!DRAFT) return null;
  return (
    <p className="mb-8 rounded-xl border border-dashed border-gold/60 bg-gold/10 px-4 py-3 text-sm! text-sidebar-foreground!">
      Draft for review. This text has not yet been approved by TiffanyAI or checked by a lawyer.
    </p>
  );
}
