"use client";

import { useEffect, useRef, useState } from "react";

const FALLBACK_HEIGHT = 1400;

// A route map (public/how-it-works.html or its light copy) in an iframe. The page posts its own
// height, so the frame grows with the content instead of scrolling inside the page.
export function HowItWorksEmbed({
  src = "/how-it-works-light.html",
  theme,
  className,
}: {
  src?: "/how-it-works.html" | "/how-it-works-light.html";
  // Landing page only: switches the dark map between its dark and light backgrounds.
  theme?: "dark" | "light";
  className?: string;
}) {
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

  useEffect(() => {
    if (!theme) return;
    const el = frame.current;
    const send = () =>
      el?.contentWindow?.postMessage({ type: "polaris-theme", theme }, window.location.origin);
    send();
    el?.addEventListener("load", send);
    return () => el?.removeEventListener("load", send);
  }, [theme]);

  return (
    <iframe
      ref={frame}
      src={src}
      title="How Polaris works"
      className={className}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  );
}
