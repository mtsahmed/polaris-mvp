"use client";

import { useState, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// A one-item-per-line box (ICP fields). The grey example text fades as soon as the box is
// clicked, and a live count under it shows how many items it holds (owner review, 18 Nov 2026).
export function ListTextarea({ className, defaultValue, onChange, ...props }: ComponentProps<typeof Textarea>) {
  const [count, setCount] = useState(() => countLines(String(defaultValue ?? "")));
  return (
    <div className="space-y-1">
      <Textarea
        {...props}
        defaultValue={defaultValue}
        onChange={(e) => {
          setCount(countLines(e.target.value));
          onChange?.(e);
        }}
        className={cn(
          "placeholder:text-muted-foreground/55 placeholder:transition-opacity placeholder:duration-300 focus:placeholder:opacity-0",
          className,
        )}
      />
      <p className="text-right text-xs text-muted-foreground/75 tabular-nums" aria-live="polite">
        {count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}
      </p>
    </div>
  );
}

function countLines(value: string) {
  return value.split("\n").filter((l) => l.trim()).length;
}
