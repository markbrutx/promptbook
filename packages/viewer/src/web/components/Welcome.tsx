import { useState } from "react";

const STORAGE_KEY = "promptbook.viewer.welcomeDismissed";

function initiallyDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One-glance orientation for first contact: four pointers tied to the
 * viewer's actual zones. Dismissing writes a localStorage flag so returning
 * visitors never see it again; storage failures fail open to showing the
 * strip, never to crashing.
 */
export function Welcome() {
  const [dismissed, setDismissed] = useState(initiallyDismissed);
  if (dismissed) {
    return null;
  }
  const dismiss = (): void => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Private-mode storage failure just means the strip returns next visit.
    }
  };
  return (
    <div className="welcome" role="note" aria-label="How to read this screen">
      <span className="welcome-item">
        <span className="welcome-arrow" aria-hidden>
          ←
        </span>
        every prompt in this book
      </span>
      <span className="welcome-item">
        <span className="welcome-swatches" aria-hidden>
          <span className="swatch" style={{ background: "hsl(210deg 70% 62%)" }} />
          <span className="swatch" style={{ background: "hsl(90deg 70% 62%)" }} />
          <span className="swatch" style={{ background: "hsl(330deg 70% 62%)" }} />
        </span>
        colored blocks = source fragments
      </span>
      <span className="welcome-item">
        flip a context axis
        <span className="welcome-arrow" aria-hidden>
          →
        </span>
        the prompt re-assembles
      </span>
      <span className="welcome-item">
        <span className="welcome-arrow" aria-hidden>
          ↑
        </span>
        Graph — the whole system as one map
      </span>
      <button type="button" className="welcome-close" aria-label="Dismiss orientation" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
