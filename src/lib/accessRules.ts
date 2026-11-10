/** The demo unlock exists only in the dev server, never in a production build. */
export function demoPremiumRequested(dev: boolean, search: string): boolean {
  if (!dev) return false;
  return new URLSearchParams(search).get("premium") === "demo";
}

export function shownRemedies<T>(remedies: readonly T[], premium: boolean): readonly T[] {
  return premium ? remedies : remedies.slice(0, 1);
}
