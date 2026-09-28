// src/mobile/lib/useOnline.js
import React from "react";

// Tracks connectivity. Deliberately pessimistic: navigator.onLine reports true
// for a phone that is associated with an AP but has no route to the internet,
// which is exactly the chill-store case, so we also fail over on a failed ping.
//
// Returns [online, setOnline]. The setter is exposed on purpose: callers (e.g. the
// sync queue drain in MobileApp) call setOnline(false) when a real request fails,
// even if the browser still claims to be online.
function useOnline() {
  const [online, setOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  React.useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return [online, setOnline];
}

export { useOnline };
