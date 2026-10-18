// The .stitchdraw format: the editor's scene JSON (elements, appState, files) under our own type tag.
// Files saved by Stitch always use this format; .excalidraw files are accepted on import only.

export const EXT = '.stitchdraw';
export const SCENE_TYPE = 'stitchdraw';
export const LIBRARY_TYPE = 'stitchdrawlib';

const IMPORTABLE = new Set(['stitchdraw', 'excalidraw']);
const IMPORTABLE_LIBRARIES = new Set(['stitchdrawlib', 'excalidrawlib']);

// serializeAsJSON / serializeLibraryAsJSON always start with `{ "type": ..., "version": n, "source": ...`.
// Rewriting that head avoids re-parsing scenes that can carry megabytes of embedded images.
const SCENE_HEAD = /^\{\s*"type":\s*"excalidraw",\s*"version":\s*(\d+),\s*"source":\s*"(?:[^"\\]|\\.)*",/;
const LIBRARY_HEAD = /^\{\s*"type":\s*"excalidrawlib",\s*"version":\s*(\d+),\s*"source":\s*"(?:[^"\\]|\\.)*",/;

function retag(json: string, head: RegExp, type: string): string {
  if (head.test(json)) return json.replace(head, `{\n  "type": "${type}",\n  "version": $1,\n  "source": "stitch",`);
  const data = JSON.parse(json);
  return JSON.stringify({ ...data, type, source: 'stitch' }, null, 2);
}

/** Converts the editor's serialized scene into a .stitchdraw document. */
export const toSceneFile = (serialized: string) => retag(serialized, SCENE_HEAD, SCENE_TYPE);

/** Converts the editor's serialized library into a .stitchdrawlib document. */
export const toLibraryFile = (serialized: string) => retag(serialized, LIBRARY_HEAD, LIBRARY_TYPE);

/** Parses an imported .stitchdraw (or legacy .excalidraw) file into a .stitchdraw scene object. */
export function parseImportedScene(text: string): Record<string, unknown> {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a valid drawing file (invalid JSON).');
  }
  if (IMPORTABLE_LIBRARIES.has(data?.type)) {
    throw new Error('That is a shape library. Drop it onto the canvas to add it to your library.');
  }
  if (!IMPORTABLE.has(data?.type) || !Array.isArray(data.elements)) {
    throw new Error('Not a drawing file. Expected a .stitchdraw or .excalidraw file.');
  }
  return { ...data, type: SCENE_TYPE, source: 'stitch' };
}

/** Drawing name for an imported file: its basename without extension, trimmed to valid characters. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.(stitchdraw|excalidraw|json)$/i, '');
  const clean = base.replace(/[^\p{L}\p{N}_ .()-]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}_]+/u, '');
  return (clean || 'Imported').slice(0, 100);
}

export function downloadSceneFile(name: string, json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}${EXT}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
