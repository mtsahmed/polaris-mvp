"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "/how-it-works-light.html";
const FALLBACK_HEIGHT = 1400;

// The light route map (public/how-it-works-light.html) in an iframe. The page posts its own
// height, so the frame grows with the content instead of scrolling inside the app.
export function HowItWorksEmbed({ className }: { className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown };
      if (data?.type !== "polaris-how-it-works-height" || typeof data.height !== "number") return;
      if (data.height > 0) setHeight(Math.ceil(data.height));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={frame}
      src={SRC}
      title="How Polaris works"
      className={className}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  );
}
