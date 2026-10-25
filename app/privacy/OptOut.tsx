"use client";

import { useSyncExternalStore } from "react";

// Umami's own opt-out: its tracker sends nothing while localStorage holds "umami.disabled".
const KEY = "umami.disabled";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab switched it
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** true: not counted; false: counted; null: storage blocked (nothing to switch, nothing stored). */
function snapshot(): boolean | null {
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return null;
  }
}

export function OptOut() {
  // Rendered on the server as null, so the switch appears only once the browser can say which way it is.
  const off = useSyncExternalStore(subscribe, snapshot, () => null);

  const toggle = () => {
    try {
      if (off) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, "1");
    } catch {
      // ignored: the snapshot reports what actually happened
    }
    listeners.forEach((l) => l());
  };

  if (off === null) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-[14px] text-ink">
        {off ? "Visits from this browser are not counted." : "Visits from this browser are counted anonymously."}
      </span>
      <button
        onClick={toggle}
        className="ml-auto rounded-full border border-cyan/40 text-cyan font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-cyan/5 focus-ring"
      >
        {off ? "Count my visits" : "Don't count my visits"}
      </button>
    </div>
  );
}
