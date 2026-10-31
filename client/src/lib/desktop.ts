/** Wrappers around the Go bindings and runtime that Wails injects into the desktop webview. */

export type BuildEvent = { log?: string; done?: boolean; exitCode?: number };

/**
 * Run a build/lint script in a tracked repo, calling onEvent for each output chunk and
 * once with { done, exitCode }. Returns a function that stops listening.
 */
export function runBuild(path: string, script: string, onEvent: (e: BuildEvent) => void): () => void {
  const runID = crypto.randomUUID();
  // Subscribe before starting so the first lines aren't missed.
  const off = window.runtime!.EventsOn(`build:${runID}`, (e: BuildEvent) => {
    onEvent(e);
    if (e.done) off();
  });
  window.go!.desktop!.App!.RunBuild(runID, path, script).catch((err) => {
    off();
    onEvent({ log: `[ERROR] ${err}\n`, done: true, exitCode: 1 });
  });
  return off;
}

/** Fetch an API response that is a file download and offer it via the native Save dialog. */
export async function saveDownload(url: string, fallbackName: string): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  return window.go!.desktop!.App!.SaveFile(name, await res.text());
}
