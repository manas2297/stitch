import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  hashElementsVersion,
  restore,
  serializeAsJSON,
  serializeLibraryAsJSON,
  useHandleLibrary,
} from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types';
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
// Global stylesheet, scoped under .excalidraw; loaded only with this lazy chunk.
import '@excalidraw/excalidraw/index.css';
import { Check, CloudOff, Download, FileUp, Loader2 } from 'lucide-react';

import { useTheme } from '@/lib/theme';
import { loadLibrary, saveDrawing, saveLibrary } from './api';
import { downloadSceneFile, toLibraryFile, toSceneFile } from './stitchdraw';

// Fonts are served by the app itself (see vite.config.mjs) so drawing works offline.
(window as any).EXCALIDRAW_ASSET_PATH = new URL('/', window.location.href).href;

const SAVE_DELAY = 800;

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

const libraryAdapter = {
  async load() {
    const lib = await loadLibrary();
    return { libraryItems: lib.libraryItems ?? lib.library ?? [] };
  },
  async save({ libraryItems }: { libraryItems: LibraryItems }) {
    await saveLibrary(toLibraryFile(serializeLibraryAsJSON(libraryItems)));
  },
};

function StatusPill({ status }: { status: SaveStatus }) {
  const map = {
    saved: { icon: <Check className="size-3.5" />, label: 'Saved', cls: 'text-muted-foreground' },
    unsaved: { icon: <span className="bg-warning size-1.5 rounded-full" />, label: 'Unsaved', cls: 'text-muted-foreground' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, label: 'Saving…', cls: 'text-muted-foreground' },
    error: { icon: <CloudOff className="size-3.5" />, label: 'Save failed', cls: 'text-destructive' },
  }[status];
  return (
    <div
      role="status"
      className={`bg-background/90 flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium shadow-sm ${map.cls}`}
    >
      {map.icon}
      <span className="hidden sm:inline">{map.label}</span>
    </div>
  );
}

const isSceneFile = (f: File) => /\.(stitchdraw|excalidraw)$/i.test(f.name);
const isLibraryFile = (f: File) => /\.(stitchdrawlib|excalidrawlib)$/i.test(f.name);

/**
 * The StitchDraw editor (built on the MIT-licensed Excalidraw engine) for one drawing. Changes autosave
 * as a .stitchdraw document; remount (via key) to switch drawings. Any pending save is flushed on unmount.
 */
export default function StitchDrawBoard({
  repo,
  name,
  scene,
  onSaved,
  onImport,
  onImportFiles,
}: {
  repo: string;
  name: string;
  scene: any;
  onSaved?: () => void;
  /** Opens the file picker to import a drawing as a new file. */
  onImport: () => void;
  /** Imports dropped drawing files as new drawings. */
  onImportFiles: (files: File[]) => void;
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ elements: readonly OrderedExcalidrawElement[]; appState: AppState; files: BinaryFiles } | null>(null);
  const lastSaved = useRef<string | null>(null);
  const contentKey = useRef<string | null>(null);
  // The whiteboard follows the app theme (top bar switcher); it has no theme toggle of its own.
  const { resolved: theme } = useTheme();
  const initialTheme = useRef(theme);

  useHandleLibrary({ excalidrawAPI: api, adapter: libraryAdapter });

  const initialData = useMemo(() => {
    const restored = restore(scene, null, null);
    return {
      elements: restored.elements,
      files: restored.files,
      appState: { ...restored.appState, theme: initialTheme.current },
      scrollToContent: true,
    };
  }, [scene]);

  const persist = useCallback(async () => {
    timer.current = null;
    const snap = latest.current;
    if (!snap) return;
    const json = serializeAsJSON(snap.elements, snap.appState, snap.files, 'local');
    if (json === lastSaved.current) {
      setStatus('saved');
      return;
    }
    setStatus('saving');
    try {
      await saveDrawing(repo, name, toSceneFile(json));
      lastSaved.current = json;
      setStatus('saved');
      onSaved?.();
    } catch {
      setStatus('error');
    }
  }, [repo, name, onSaved]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  // Flush on unmount (switching drawing/scope or leaving the tab).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persistRef.current();
      }
    },
    [],
  );

  const handleChange = (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    latest.current = { elements, appState, files };
    // onChange also fires for selection, scrolling and layout; only content changes schedule a save.
    const key = [
      hashElementsVersion(elements),
      Object.keys(files).length,
      appState.viewBackgroundColor,
      appState.gridModeEnabled,
      appState.gridSize,
    ].join('|');
    if (contentKey.current === null) {
      // First change event reflects the loaded scene; use it as the saved baseline.
      contentKey.current = key;
      lastSaved.current = serializeAsJSON(elements, appState, files, 'local');
      return;
    }
    if (key === contentKey.current) return;
    contentKey.current = key;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persistRef.current(), SAVE_DELAY);
    setStatus((s) => (s === 'saving' ? s : 'unsaved'));
  };

  const download = () => {
    const snap = latest.current;
    if (snap) downloadSceneFile(name, toSceneFile(serializeAsJSON(snap.elements, snap.appState, snap.files, 'local')));
  };

  // The engine only understands its own file types on drop, so drawing and library files are
  // intercepted here: drawings import as new files, libraries merge into the shared library.
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    const dropped = [...e.dataTransfer.files];
    const scenes = dropped.filter(isSceneFile);
    const libraries = dropped.filter(isLibraryFile);
    if (!scenes.length && !libraries.length) return;
    e.preventDefault();
    e.stopPropagation();
    if (scenes.length) onImportFiles(scenes);
    for (const file of libraries) {
      try {
        const data = JSON.parse(await file.text());
        const items = data.libraryItems ?? data.library ?? [];
        await api?.updateLibrary({ libraryItems: items, merge: true, openLibraryMenu: true });
      } catch {
        /* the library panel shows nothing new; malformed file */
      }
    }
  };

  return (
    <div className="h-full w-full" onDropCapture={handleDrop}>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        name={name}
        theme={theme}
        autoFocus
        UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, saveAsImage: true } }}
        renderTopRightUI={() => <StatusPill status={status} />}
      >
        <MainMenu>
          <MainMenu.Item icon={<FileUp size={16} />} onSelect={onImport}>
            Import drawing…
          </MainMenu.Item>
          <MainMenu.Item icon={<Download size={16} />} onSelect={download}>
            Download .stitchdraw
          </MainMenu.Item>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.HelpHint />
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>Sketch your system architecture</WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItem icon={<FileUp size={16} />} onSelect={onImport}>
                Import drawing…
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>
    </div>
  );
}
