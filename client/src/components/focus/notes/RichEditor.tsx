import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { Bold, Code, Highlighter, Italic, Link2, ListPlus, Strikethrough, Underline } from 'lucide-react';

import { cn } from '@/lib/utils';
import { matchCommands, type SlashCommand } from './commands';

const lowlight = createLowlight(common);

/** Stored content is editor JSON; older pages hold HTML (templates) or plain text (scratchpad). */
export function parseStoredContent(content: string): JSONContent | string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{')) {
    try {
      const doc = JSON.parse(trimmed);
      if (doc?.type === 'doc') return doc;
    } catch {
      /* fall through to plain text */
    }
  }
  if (trimmed.startsWith('<')) return trimmed;
  return {
    type: 'doc',
    content: content.split('\n').map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
  };
}

/** Plain text of a stored page, for search and previews. */
export function plainText(content: string) {
  const parsed = parseStoredContent(content);
  if (typeof parsed === 'string') return parsed.replace(/<[^>]+>/g, ' ');
  const out: string[] = [];
  const walk = (n: JSONContent) => {
    if (n.text) out.push(n.text);
    n.content?.forEach(walk);
  };
  walk(parsed);
  return out.join(' ');
}

interface SlashState {
  query: string;
  from: number;
  to: number;
  left: number;
  top: number;
}

function SlashMenu({ state, items, active, onPick, onHover }: { state: SlashState; items: SlashCommand[]; active: number; onPick: (c: SlashCommand) => void; onHover: (i: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      aria-label="Insert block"
      className="bg-popover text-popover-foreground fixed z-50 max-h-80 w-72 overflow-y-auto rounded-lg border p-1 shadow-lg"
      style={{ left: state.left, top: state.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground px-3 py-2 text-sm">No matching blocks</p>
      ) : (
        <>
          <p className="text-muted-foreground px-2 pt-1 pb-1.5 text-[0.68rem] font-semibold tracking-wider uppercase">Blocks</p>
          {items.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === active}
              data-index={i}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(c)}
              className={cn('flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left', i === active && 'bg-accent')}
            >
              <span className="bg-background inline-flex size-9 shrink-0 items-center justify-center rounded-md border">
                <c.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{c.hint}</span>
              </span>
            </button>
          ))}
        </>
      )}
    </div>,
    document.body,
  );
}

function ToolbarButton({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn('hover:bg-accent inline-flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5', active && 'bg-accent text-primary')}
    >
      {children}
    </button>
  );
}

function SelectionToolbar({ editor, onCreateTask }: { editor: Editor; onCreateTask?: (title: string) => void }) {
  const [linking, setLinking] = useState(false);
  const [href, setHref] = useState('');
  const marks = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
    }),
  });

  const applyLink = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
    setLinking(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive('codeBlock') && e.isEditable}
      className="bg-popover text-popover-foreground flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
    >
      {linking ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setLinking(false)}
            placeholder="Paste a link…"
            className="bg-background h-7 w-56 rounded-md border px-2 text-xs outline-none"
            aria-label="Link URL"
          />
          <button type="submit" className="hover:bg-accent h-7 rounded-md px-2 text-xs font-semibold">
            {href.trim() ? 'Apply' : 'Remove'}
          </button>
        </form>
      ) : (
        <>
          <ToolbarButton label="Bold (⌘B)" active={marks.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold />
          </ToolbarButton>
          <ToolbarButton label="Italic (⌘I)" active={marks.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic />
          </ToolbarButton>
          <ToolbarButton label="Underline (⌘U)" active={marks.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <Underline />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" active={marks.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough />
          </ToolbarButton>
          <ToolbarButton label="Inline code (⌘E)" active={marks.code} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code />
          </ToolbarButton>
          <ToolbarButton label="Highlight" active={marks.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <Highlighter />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={marks.link}
            onClick={() => {
              setHref(editor.getAttributes('link').href ?? '');
              setLinking(true);
            }}
          >
            <Link2 />
          </ToolbarButton>
          {onCreateTask && (
            <>
              <span className="bg-border mx-0.5 h-5 w-px" />
              <button
                type="button"
                onClick={() => {
                  const { from, to } = editor.state.selection;
                  const text = editor.state.doc.textBetween(from, to, ' ').trim();
                  if (text) onCreateTask(text.slice(0, 200));
                }}
                className="hover:bg-accent inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold"
              >
                <ListPlus className="size-3.5" /> Task
              </button>
            </>
          )}
        </>
      )}
    </BubbleMenu>
  );
}

export default function RichEditor({
  content,
  onChange,
  onCreateTask,
  onStats,
  autoFocus,
}: {
  content: string;
  onChange: (json: string) => void;
  onCreateTask?: (title: string) => void;
  onStats?: (s: { words: number }) => void;
  autoFocus?: boolean;
}) {
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [active, setActive] = useState(0);
  const items = useMemo(() => (slash ? matchCommands(slash.query) : []), [slash]);

  // Editor callbacks are bound once, so they read the latest menu state through refs.
  const slashRef = useRef<{ slash: SlashState | null; items: SlashCommand[]; active: number }>({ slash: null, items: [], active: 0 });
  slashRef.current = { slash, items, active };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Latest unsaved document, kept outside the editor so it can be flushed even after teardown.
  const pending = useRef<JSONContent | null>(null);
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current) {
      const doc = pending.current;
      pending.current = null;
      onChangeRef.current(JSON.stringify(doc));
    }
  };

  const run = (editor: Editor, cmd: SlashCommand) => {
    const s = slashRef.current.slash;
    if (s) editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    cmd.run(editor);
    setSlash(null);
  };

  const detectSlash = (editor: Editor) => {
    const { $from, empty } = editor.state.selection;
    if (!empty || $from.parent.type.name === 'codeBlock') return setSlash(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
    const m = before.match(/(?:^|\s)\/([\w-]{0,20})$/);
    if (!m) return setSlash(null);
    const from = $from.pos - m[1].length - 1;
    const coords = editor.view.coordsAtPos(from);
    const below = window.innerHeight - coords.bottom > 340;
    setSlash((prev) => {
      if (!prev || prev.query !== m[1]) setActive(0);
      return { query: m[1], from, to: $from.pos, left: Math.min(coords.left, window.innerWidth - 300), top: below ? coords.bottom + 6 : coords.top - 330 };
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
        heading: { levels: [1, 2, 3] },
      }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      TableKit.configure({ table: { resizable: true } }),
      CharacterCount,
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? `Heading ${node.attrs.level}` : "Write, or type '/' for blocks…"),
        includeChildren: true,
      }),
    ],
    content: parseStoredContent(content),
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: true,
    editorProps: {
      attributes: { class: 'notion-editor', spellcheck: 'true' },
      handleKeyDown: (view, event) => {
        const { slash: s, items: list, active: idx } = slashRef.current;
        if (!s) return false;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const n = Math.max(list.length, 1);
          setActive((idx + (event.key === 'ArrowDown' ? 1 : n - 1)) % n);
          return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && list[idx]) {
          run(editorRef.current!, list[idx]);
          return true;
        }
        if (event.key === 'Escape') {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      detectSlash(e);
      onStats?.({ words: e.storage.characterCount.words() });
      pending.current = e.getJSON();
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    onSelectionUpdate: ({ editor: e }) => detectSlash(e),
    onBlur: () => {
      setSlash(null);
      flush();
    },
    onCreate: ({ editor: e }) => onStats?.({ words: e.storage.characterCount.words() }),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  // Flush a pending save when the page closes or switches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => flush, []);

  if (!editor) return null;

  return (
    <>
      <EditorContent editor={editor} />
      <SelectionToolbar editor={editor} onCreateTask={onCreateTask} />
      {slash && <SlashMenu state={slash} items={items} active={active} onHover={setActive} onPick={(c) => run(editor, c)} />}
    </>
  );
}
