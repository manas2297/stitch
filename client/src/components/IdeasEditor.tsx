import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, Pencil, Plus, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { compileMarkdown } from '../helper';
import { confirmDialog } from '../helper/confirm';
import { apiFetch } from '../store/useAppStore';
import LoadingState from './layout/LoadingState';
import { useToast } from './Toast';

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

type ViewMode = 'edit' | 'preview' | 'split';

const FORMATS: { label: React.ReactNode; title: string; before: string; after?: string }[] = [
  { label: <strong>B</strong>, title: 'Bold', before: '**', after: '**' },
  { label: <em>I</em>, title: 'Italic', before: '*', after: '*' },
  { label: 'H', title: 'Heading', before: '### ' },
  { label: 'Code', title: 'Inline Code', before: '`', after: '`' },
  { label: 'Block', title: 'Code Block', before: '```\n', after: '\n```' },
  { label: '• List', title: 'Bullet List', before: '- ' },
  { label: '☑ Todo', title: 'Checkbox List', before: '- [ ] ' },
];

export default function IdeasEditor({ owner, name }) {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [fileMode, setFileMode] = useState<'view' | 'edit' | ''>('');
  const [newFilename, setNewFilename] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  const loadFilesList = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/ideas?owner=${owner}&name=${name}`);
      if (!res.ok) throw new Error('Failed to load ideas files list');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFilesList();
  }, [owner, name]);

  const openFile = async (filename: string, mode: 'view' | 'edit') => {
    setLoading(true);
    setFileMode(mode);
    try {
      const res = await apiFetch(`/api/ideas/file?owner=${owner}&name=${name}&filename=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`Failed to load file ${filename}`);
      const data = await res.json();
      setContent(data.content || '');
      setActiveFile(filename);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    let cleaned = newFilename.trim();
    if (!cleaned) return;
    if (!cleaned.endsWith('.md') && !cleaned.endsWith('.txt')) cleaned += '.md';

    setSaving(true);
    try {
      const res = await apiFetch('/api/ideas/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          name,
          filename: cleaned,
          content: '# ' + cleaned.replace(/\.[^/.]+$/, '') + '\n\nWrite your ideas here...',
        }),
      });
      if (!res.ok) throw new Error('Failed to create file');
      toast(`File ${cleaned} created successfully.`, 'success');
      setNewFilename('');
      await loadFilesList();
      openFile(cleaned, 'edit');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      const res = await apiFetch('/api/ideas/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, name, filename: activeFile, content }),
      });
      if (!res.ok) throw new Error('Failed to save file');
      toast(`Saved ${activeFile} successfully.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (filename: string, e) => {
    e.stopPropagation();
    const confirmed = await confirmDialog('Delete File', `Are you sure you want to delete ${filename}?`);
    if (!confirmed) return;
    try {
      const res = await apiFetch(`/api/ideas/file?owner=${owner}&name=${name}&filename=${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete file');
      toast(`Deleted ${filename}`, 'info');
      if (activeFile === filename) {
        setActiveFile(null);
        setContent('');
      }
      loadFilesList();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const insertFormat = (before: string, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    setContent(text.substring(0, start) + before + selected + after + text.substring(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // Cmd/Ctrl+S saves the open file
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, activeFile, owner, name]);

  if (loading && !activeFile) return <LoadingState label="Loading ideas files..." />;

  const preview = (
    <div className="bg-card min-h-64 overflow-auto rounded-xl border p-4">
      {content ? (
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: compileMarkdown(content) }} />
      ) : (
        <p className="text-muted-foreground mt-12 text-center text-sm">
          Nothing to preview yet. Write some Markdown to see it rendered here.
        </p>
      )}
    </div>
  );

  // --- Read-only view ---
  if (activeFile && fileMode === 'view') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActiveFile(null)}>
            <ArrowLeft /> Back to List
          </Button>
          <Button size="sm" onClick={() => setFileMode('edit')}>
            <Pencil /> Edit File
          </Button>
          <span className="text-muted-foreground text-sm font-semibold break-all sm:ml-2">Viewing: {activeFile}</span>
        </div>
        {preview}
      </div>
    );
  }

  // --- File list ---
  if (!activeFile) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold">🧠 Project Ideas Workspace</h3>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">
              Save notes, specifications, or brainstorming ideas in text/markdown files inside your local project workspace.
            </p>
          </div>
          <form onSubmit={handleCreateFile} className="flex gap-2">
            <Input
              className="min-w-0 lg:w-56"
              placeholder="new_idea.md..."
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              required
              aria-label="New file name"
            />
            <Button type="submit" disabled={saving} className="shrink-0">
              <Plus /> {saving ? 'Creating...' : 'Create File'}
            </Button>
          </form>
        </div>

        {files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No ideas files found in this workspace yet."
            description="Enter a filename above to create your first markdown document."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {files.map((f) => (
              <Card
                key={f.filename}
                role="button"
                tabIndex={0}
                onClick={() => openFile(f.filename, 'view')}
                onKeyDown={(e) => e.key === 'Enter' && openFile(f.filename, 'view')}
                className="hover:border-primary/40 cursor-pointer gap-3 py-4 transition-colors"
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex-1 truncate font-semibold">{f.filename}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDeleteFile(f.filename, e)}
                      aria-label={`Delete ${f.filename}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className="text-muted-foreground flex flex-col text-xs">
                      <span>Size: {formatBytes(f.size)}</span>
                      <span>Edited: {f.modified || '—'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="xs" onClick={(e) => { e.stopPropagation(); openFile(f.filename, 'view'); }}>
                        View
                      </Button>
                      <Button size="xs" variant="secondary" onClick={(e) => { e.stopPropagation(); openFile(f.filename, 'edit'); }}>
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Editor ---
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-xl border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setActiveFile(null);
            loadFilesList();
          }}
        >
          <ArrowLeft /> Back to Files
        </Button>
        <span className="text-sm font-semibold break-all md:border-l md:pl-3">📄 {activeFile}</span>

        <div className="flex flex-wrap gap-1 md:ml-2">
          {FORMATS.map((f) => (
            <Button key={f.title} variant="ghost" size="xs" title={f.title} onClick={() => insertFormat(f.before, f.after)}>
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-1 md:ml-auto">
          {(['edit', 'preview', 'split'] as ViewMode[]).map((m) => (
            <Button
              key={m}
              size="xs"
              variant={viewMode === m ? 'default' : 'ghost'}
              className={cn('capitalize', m === 'split' && 'hidden md:inline-flex')}
              onClick={() => setViewMode(m)}
            >
              {m}
            </Button>
          ))}
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save /> {saving ? 'Saving...' : 'Save (⌘S)'}
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Opening file..." />
      ) : (
        <div className={cn('grid gap-3', viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
          {(viewMode === 'edit' || viewMode === 'split') && (
            <Textarea
              ref={textareaRef}
              className="min-h-[50vh] resize-y font-mono text-sm"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your ideas, notes, or brainstorming specs here using Markdown..."
            />
          )}
          {(viewMode === 'preview' || viewMode === 'split') && preview}
        </div>
      )}
    </div>
  );
}
