import { useId } from "react";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

// Four-point north star filled with the TiffanyAI magenta to gold gradient.
export function StarIcon({ className, plain = false }: { className?: string; plain?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      {!plain && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c4006a" />
            <stop offset="58%" stopColor="#ff7a3d" />
            <stop offset="100%" stopColor="#ffd700" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={plain ? "currentColor" : `url(#${id})`}
        d="M12 1.5c.4 4.9 2.1 8.6 10.5 10.5-8.4 1.9-10.1 5.6-10.5 10.5-.4-4.9-2.1-8.6-10.5-10.5C9.9 10.1 11.6 6.4 12 1.5Z"
      />
    </svg>
  );
}

export function BrandMark({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <StarIcon className="size-7" />
      <div className="leading-none">
        <div className="font-heading text-2xl font-semibold tracking-tight">{brand.productName}</div>
        {subtitle && (
          <div className="mt-1.5 font-mono text-xs font-medium tracking-wide opacity-80">by {brand.companyName}</div>
        )}
      </div>
    </div>
  );
}
