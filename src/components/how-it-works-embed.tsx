"use client";

import { useEffect, useRef, useState } from "react";

const FALLBACK_HEIGHT = 1400;

// A route map (public/how-it-works.html or its light copy) in an iframe. The page posts its own
// height, so the frame grows with the content instead of scrolling inside the page.
// fixed: the frame keeps the height of the map's tallest step (it changes only when the window is
// resized), so moving along the route never moves the sections below it.
export function HowItWorksEmbed({
  src = "/how-it-works-light.html",
  theme,
  className,
  fixed = false,
}: {
  src?: "/how-it-works.html" | "/how-it-works.html?nodiff=1" | "/how-it-works-light.html";
  // Landing page only: switches the dark map between its dark and light backgrounds.
  theme?: "dark" | "light";
  className?: string;
  fixed?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(FALLBACK_HEIGHT);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown; maxHeight?: unknown };
      if (data?.type !== "polaris-how-it-works-height" || typeof data.height !== "number") return;
      const next = fixed && typeof data.maxHeight === "number" ? data.maxHeight : data.height;
      if (next > 0) setHeight(Math.ceil(next));
    }
    window.addEventListener("message", onMessage);
    // The frame may report its height before this listener exists, so ask again now and on load.
    const el = frame.current;
    const ask = () => el?.contentWindow?.postMessage({ type: "polaris-height-request" }, window.location.origin);
    ask();
    el?.addEventListener("load", ask);
    return () => {
      window.removeEventListener("message", onMessage);
      el?.removeEventListener("load", ask);
    };
  }, [fixed]);

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
      src={fixed ? `${src}${src.includes("?") ? "&" : "?"}fixed=1` : src}
      title="How Polaris works"
      className={className}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  );
}
