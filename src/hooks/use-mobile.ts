import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

/**
 * Viewport hook implemented with `useSyncExternalStore` so the mobile flag is
 * derived from the DOM in a single render pass — the previous version wrote it
 * with `setState` inside an effect, which triggers a cascading render.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    // Server snapshot: assume desktop so markup matches the common case and
    // re-syncs on the first client render.
    () => false
  )
}
