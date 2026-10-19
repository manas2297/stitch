import type { Editor } from '@tiptap/react';
import {
  CalendarDays,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table,
  type LucideIcon,
} from 'lucide-react';

export interface SlashCommand {
  id: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
  run: (editor: Editor) => void;
}

/** Block types offered by the "/" menu, Notion style. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'text', title: 'Text', hint: 'Plain paragraph', icon: Pilcrow, keywords: 'paragraph p body', run: (e) => e.chain().focus().setParagraph().run() },
  { id: 'h1', title: 'Heading 1', hint: 'Big section heading  ·  #', icon: Heading1, keywords: 'title h1', run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { id: 'h2', title: 'Heading 2', hint: 'Medium heading  ·  ##', icon: Heading2, keywords: 'subtitle h2', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { id: 'h3', title: 'Heading 3', hint: 'Small heading  ·  ###', icon: Heading3, keywords: 'h3', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { id: 'todo', title: 'To-do list', hint: 'Track tasks  ·  [ ]', icon: ListChecks, keywords: 'checkbox task check', run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: 'bullet', title: 'Bulleted list', hint: 'Simple list  ·  -', icon: List, keywords: 'ul unordered bullets', run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'numbered', title: 'Numbered list', hint: 'Ordered list  ·  1.', icon: ListOrdered, keywords: 'ol ordered numbers', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'quote', title: 'Quote', hint: 'Call out a passage  ·  >', icon: Quote, keywords: 'blockquote citation', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', title: 'Code block', hint: 'Syntax highlighted  ·  ```', icon: Code2, keywords: 'snippet pre programming', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'table', title: 'Table', hint: '3 × 3 with header row', icon: Table, keywords: 'grid columns rows', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'divider', title: 'Divider', hint: 'Visual separator  ·  ---', icon: Minus, keywords: 'hr rule line separator', run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    id: 'date',
    title: "Today's date",
    hint: 'Insert the date',
    icon: CalendarDays,
    keywords: 'now today time',
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent(new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' ')
        .run(),
  },
];

export function matchCommands(query: string) {
  const q = query.toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.title.toLowerCase().includes(q) || c.keywords.includes(q) || c.id.startsWith(q));
}

/** Starting points for new pages; HTML is converted to the editor's JSON on first save. */
export const TEMPLATES: { id: string; title: string; icon: string; html: string }[] = [
  { id: 'blank', title: 'Blank page', icon: '📄', html: '' },
  {
    id: 'meeting',
    title: 'Meeting notes',
    icon: '🗓️',
    html: '<h2>Agenda</h2><ul><li><p></p></li></ul><h2>Notes</h2><p></p><h2>Decisions</h2><ul><li><p></p></li></ul><h2>Action items</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
  },
  {
    id: 'design',
    title: 'Design doc',
    icon: '🧭',
    html: '<h2>Context</h2><p>What problem are we solving, and why now?</p><h2>Goals</h2><ul><li><p></p></li></ul><h2>Non-goals</h2><ul><li><p></p></li></ul><h2>Proposal</h2><p></p><h2>Alternatives considered</h2><p></p><h2>Rollout &amp; risks</h2><p></p><h2>Open questions</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
  },
  {
    id: 'bug',
    title: 'Bug investigation',
    icon: '🐛',
    html: '<h2>Symptoms</h2><p></p><h2>Steps to reproduce</h2><ol><li><p></p></li></ol><h2>Expected vs actual</h2><p></p><h2>Logs</h2><pre><code></code></pre><h2>Root cause</h2><p></p><h2>Fix</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>',
  },
  {
    id: 'daily',
    title: 'Daily log',
    icon: '📓',
    html: '<h2>Yesterday</h2><ul><li><p></p></li></ul><h2>Today</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul><h2>Blockers</h2><p></p>',
  },
];

export const PAGE_ICONS = ['📄', '📝', '📓', '🧭', '🗓️', '🐛', '💡', '🚀', '🧪', '🔧', '📦', '🔒', '⚡', '🎯', '📈', '🧠', '🗺️', '📚', '✅', '❓', '🔥', '🌱', '🛠️', '🧩'];
