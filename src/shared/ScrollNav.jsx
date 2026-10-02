import React, { useEffect, useState } from "react";

/**
 * ScrollNav — small "top of page" / "bottom of page" buttons for long screens.
 *
 * Appears only when the page is long (more than about one and a half screens)
 * and you've started scrolling: ▲ once you're away from the top, ▼ until you
 * reach the bottom. Sits bottom-right, under pop-up windows (z-index 80).
 *
 * props:
 *   scrollRef  — a ref to the element that scrolls (the phone layout's <main>);
 *                leave out to use the browser window (desktop portal).
 *   bottom     — distance from the bottom of the screen (CSS value), so it can
 *                sit above a tab bar or another floating button.
 *   watchKey   — anything that changes when the screen changes (phone), so the
 *                new screen's length is measured.
 *   Z, font    — theme tokens and font.
 */
function ScrollNav({ scrollRef, watchKey, bottom = 24, Z, font }) {
  const [st, setSt] = useState({ top: false, end: false });

  useEffect(() => {
    const el = scrollRef ? scrollRef.current : null;
    if (scrollRef && !el) return undefined;
    const target = el || window;
    const measure = () => {
      const pos = el ? el.scrollTop : window.scrollY;
      const view = el ? el.clientHeight : window.innerHeight;
      const full = el ? el.scrollHeight : Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
      const long = full > view * 1.5;
      const gap = Math.min(200, view * 0.25);   // how far from the top / bottom before its button shows
      const next = { top: long && pos > gap, end: long && full - view - pos > gap };
      setSt(p => (p.top === next.top && p.end === next.end ? p : next));
    };
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); }); };
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // content can grow without any scrolling (data arriving, sections opening)
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    if (ro) ro.observe(el ? (el.firstElementChild || el) : document.body);
    measure();
    return () => { target.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (ro) ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [scrollRef, watchKey]);

  if (!st.top && !st.end) return null;
  const go = where => {
    const el = scrollRef ? scrollRef.current : null;
    const smooth = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const top = where === "top" ? 0 : (el ? el.scrollHeight : document.documentElement.scrollHeight);
    (el || window).scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  };
  const b = {
    width: 42, height: 42, borderRadius: "50%", border: `1px solid ${Z.borderMd}`,
    background: Z.navyMd, color: Z.white, cursor: "pointer", fontSize: 16, fontWeight: 900,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font,
    boxShadow: "0 4px 16px rgba(0,0,0,0.35)", opacity: 0.92, padding: 0,
  };
  return (
    <div data-testid="scroll-nav" style={{ position: "fixed", right: 18, bottom, zIndex: 80, display: "flex", flexDirection: "column", gap: 8 }}>
      {st.top && <button type="button" onClick={() => go("top")} aria-label="Back to top" title="Back to top" style={b}>▲</button>}
      {st.end && <button type="button" onClick={() => go("end")} aria-label="Go to bottom" title="Go to bottom of page" style={b}>▼</button>}
    </div>
  );
}

export { ScrollNav };
