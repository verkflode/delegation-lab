// Umami analytics, self-hosted on the Lab's own server and cookieless. The tracker is loaded in
// app/layout.tsx; events carry no personal data, only which step of the game a visit reached.
// Where the tracker isn't loaded (local dev, other hosts) this does nothing, and it never throws:
// analytics must not be able to break the game.

type Payload = Record<string, unknown>;
type Umami = { track: (event: string | ((payload: Payload) => Payload), data?: Record<string, string | number>) => void };

function umami(): Umami | undefined {
  return (window as unknown as { umami?: Umami }).umami;
}

export function track(event: string, data?: Record<string, string | number>): void {
  try {
    umami()?.track(event, data);
  } catch {
    // ignored on purpose
  }
}

/**
 * A virtual page view for a stage of the game (the Lab is one page). Umami measures visit duration and
 * the pages view from page views only, so without these a whole game looks like one page and a visit
 * seems to end on arrival.
 */
export function pageview(path: string, title: string): void {
  try {
    umami()?.track((payload) => ({ ...payload, url: path, title }));
  } catch {
    // ignored on purpose
  }
}
