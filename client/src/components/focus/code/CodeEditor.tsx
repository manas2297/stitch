import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Bundle Monaco's workers ourselves so the editor works offline (desktop app) with no CDN.
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

// There is no tsconfig/node_modules in the browser, so semantic checks would flag every import.
// Keep syntax errors only.
for (const defaults of [monaco.languages.typescript.typescriptDefaults, monaco.languages.typescript.javascriptDefaults]) {
  defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  defaults.setCompilerOptions({ ...defaults.getCompilerOptions(), jsx: monaco.languages.typescript.JsxEmit.Preserve, allowNonTsExtensions: true, target: monaco.languages.typescript.ScriptTarget.ESNext });
}

type Props = {
  /** Identity of the open document; each path gets its own model (and so its own undo history). */
  path: string;
  value: string;
  dark: boolean;
  readOnly: boolean;
  onChange: (path: string, value: string) => void;
  onSave: (path: string) => void;
  /** Paths still open; models for any other path are disposed. */
  openPaths: string[];
};

const uriFor = (path: string) => monaco.Uri.from({ scheme: 'file', path: '/' + path });

export default function CodeEditor({ path, value, dark, readOnly, onChange, onSave, openPaths }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const viewStates = useRef(new Map<string, monaco.editor.ICodeEditorViewState | null>());
  const current = useRef<string | null>(null);
  // Latest props for callbacks registered once.
  const live = useRef({ onChange, onSave });
  live.current = { onChange, onSave };

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      model: null,
      automaticLayout: true,
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      padding: { top: 8, bottom: 8 },
      tabSize: 2,
    });
    editor.current = ed;
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (current.current) live.current.onSave(current.current);
    });
    const sub = ed.onDidChangeModelContent(() => {
      const model = ed.getModel();
      if (model && current.current) live.current.onChange(current.current, model.getValue());
    });
    return () => {
      sub.dispose();
      ed.dispose();
      editor.current = null;
      current.current = null;
    };
  }, []);

  // Swap models when the active file changes.
  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    if (current.current) viewStates.current.set(current.current, ed.saveViewState());
    const uri = uriFor(path);
    const model = monaco.editor.getModel(uri) ?? monaco.editor.createModel(value, undefined, uri);
    current.current = path;
    ed.setModel(model);
    const vs = viewStates.current.get(path);
    if (vs) ed.restoreViewState(vs);
    ed.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // External content change for the open file (e.g. reload from disk).
  useEffect(() => {
    const model = editor.current?.getModel();
    if (model && model.getValue() !== value) model.setValue(value);
  }, [value]);

  useEffect(() => {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }, [dark]);

  useEffect(() => {
    editor.current?.updateOptions({ readOnly });
  }, [readOnly]);

  // Dispose models of closed files.
  useEffect(() => {
    const open = new Set(openPaths.map((p) => uriFor(p).toString()));
    for (const m of monaco.editor.getModels()) {
      if (!open.has(m.uri.toString())) {
        m.dispose();
      }
    }
    for (const k of viewStates.current.keys()) if (!openPaths.includes(k)) viewStates.current.delete(k);
  }, [openPaths]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
