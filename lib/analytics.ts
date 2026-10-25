// Umami analytics, self-hosted on the Lab's own server and cookieless. The tracker is loaded in
// app/layout.tsx; events carry no personal data, only which step of the game a visit reached.
// Where the tracker isn't loaded (local dev, other hosts) this does nothing, and it never throws:
// analytics must not be able to break the game.

type Umami = { track: (event: string, data?: Record<string, string | number>) => void };

export function track(event: string, data?: Record<string, string | number>): void {
  try {
    (window as unknown as { umami?: Umami }).umami?.track(event, data);
  } catch {
    // ignored on purpose
  }
}
