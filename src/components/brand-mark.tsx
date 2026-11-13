import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

// Four-point north star in gold, next to the wordmark.
export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5 text-gold", className)}>
      <path
        fill="currentColor"
        d="M12 1.5c.4 4.9 2.1 8.6 10.5 10.5-8.4 1.9-10.1 5.6-10.5 10.5-.4-4.9-2.1-8.6-10.5-10.5C9.9 10.1 11.6 6.4 12 1.5Z"
      />
    </svg>
  );
}

export function BrandMark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <StarIcon />
      <div className="leading-none">
        <div className="font-heading text-2xl tracking-tight">{brand.productName}</div>
        {subtitle && (
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] opacity-60">
            by {brand.companyName}
          </div>
        )}
      </div>
    </div>
  );
}
