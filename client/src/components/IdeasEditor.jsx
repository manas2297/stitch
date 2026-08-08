import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../store/useAppStore';
import { useToast } from './Toast';
import { compileMarkdown } from '../helper';


function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function IdeasEditor({ owner, name }) {
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'preview' or 'split'
  const [fileMode, setFileMode] = useState(''); // 'view' or 'edit'
  const [newFilename, setNewFilename] = useState('');
  const textareaRef = useRef(null);
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

  const setFileViewMode = async (mode, filename) => {
    setLoading(true);
    setFileMode(mode);
    try {
      const res = await apiFetch(`/api/ideas/file?owner=${owner}&name=${name}&filename=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error(`Failed to load file ${filename}`);
      const data = await res.json();
      setContent(data.content || '');
      setActiveFile(filename);
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false);
    }
  }

  const handleOpenFile = async (filename) => {
    setLoading(true);
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
    if (!cleaned.endsWith('.md') && !cleaned.endsWith('.txt')) {
      cleaned += '.md';
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/ideas/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, name, filename: cleaned, content: '# ' + cleaned.replace(/\.[^/.]+$/, '') + '\n\nWrite your ideas here...' }),
      });
      if (!res.ok) throw new Error('Failed to create file');
      toast(`File ${cleaned} created successfully.`, 'success');
      setNewFilename('');
      await loadFilesList();
      handleOpenFile(cleaned);
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

  const handleDeleteFile = async (filename, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) {
      return;
    }
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

  const insertFormat = (syntaxBefore, syntaxAfter = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = syntaxBefore + selectedText + syntaxAfter;

    setContent(text.substring(0, start) + replacement + text.substring(end));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntaxBefore.length, start + syntaxBefore.length + selectedText.length);
    }, 0);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, activeFile, owner, name]);

  if (loading && !activeFile) {
    return (
      <div className="ideas-loading">
        <div className="spinner"></div>
        <span>Loading ideas files...</span>
      </div>
    );
  }

  // --- rendering the preview mode

  if (activeFile && fileMode == 'view') {
    return (
      <div>
        <header className="view-header">
          <div className="view-header-left">
            <button onClick={() => setActiveFile(null)} className="back-btn">
              ← Back to List
            </button>
          </div>
        </header>

        <div className="workspace-panel preview-panel">
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: compileMarkdown(content) }}
          />
        </div>
      </div>

    )
  }
  // --- RENDERING LIST MODE ---
  if (!activeFile) {
    return (
      <div className="ideas-list-mode">
        <div className="list-mode-header">
          <div className="header-title-box">
            <h3>🧠 Project Ideas Workspace</h3>
            <p>Save notes, specifications, or brainstorming ideas in text/markdown files inside your local project workspace.</p>
          </div>

          <form onSubmit={handleCreateFile} className="create-file-form">
            <input
              type="text"
              className="roadmap-input"
              style={{ fontSize: '0.85rem', padding: '6px 12px', minWidth: 200 }}
              placeholder="new_idea.md..."
              value={newFilename}
              onChange={(e) => setNewFilename(e.target.value)}
              required
            />
            <button type="submit" disabled={saving} className="btn">
              {saving ? 'Creating...' : '+ Create File'}
            </button>
          </form>
        </div>

        <div className="ideas-files-grid">
          {files.length === 0 ? (
            <div className="no-files-empty">
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📝</div>
              <div>No ideas files found in this workspace yet.</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                Enter a filename above to create your first markdown document.
              </p>
            </div>
          ) : (
            files.map((f) => (
              <div key={f.filename} className="idea-file-card" onClick={() => handleOpenFile(f.filename)}>
                <div className="card-top">
                  <span className="file-icon">📄</span>
                  <span className="file-name">{f.filename}</span>
                  <button className="delete-file-btn" onClick={(e) => handleDeleteFile(f.filename, e)} title="Delete File">
                    ✕
                  </button>
                </div>
                <div className="card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Size: {formatBytes(f.size)}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Edited: {f.modified || '—'}</span>
                  </div>
                  <button onClick={() => setFileViewMode('view', f.filename)} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>
                    View
                  </button>
                  <button onClick={() => setFileViewMode('edit', f.filename)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: '4px' }}>
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- RENDERING EDIT MODE ---
  return (
    <div className="ideas-editor-container">
      {/* Editor Toolbar */}
      <div className="ideas-toolbar">
        <button onClick={() => { setActiveFile(null); loadFilesList(); }} className="tb-btn mode-btn back-to-list-btn">
          ← Back to Files
        </button>

        <div className="toolbar-file-label" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white', marginRight: '1rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
          📄 {activeFile}
        </div>

        <div className="toolbar-group formatting">
          <button onClick={() => insertFormat('**', '**')} title="Bold" className="tb-btn"><strong>B</strong></button>
          <button onClick={() => insertFormat('*', '*')} title="Italic" className="tb-btn"><em>I</em></button>
          <button onClick={() => insertFormat('### ')} title="Heading" className="tb-btn">H</button>
          <button onClick={() => insertFormat('`', '`')} title="Inline Code" className="tb-btn">Code</button>
          <button onClick={() => insertFormat('```\n', '\n```')} title="Code Block" className="tb-btn">Block</button>
          <button onClick={() => insertFormat('- ')} title="Bullet List" className="tb-btn">• List</button>
          <button onClick={() => insertFormat('- [ ] ')} title="Checkbox List" className="tb-btn">☑ Todo</button>
        </div>

        <div className="toolbar-group view-modes">
          <button onClick={() => setViewMode('edit')} className={`tb-btn mode-btn ${viewMode === 'edit' ? 'active' : ''}`}>Edit</button>
          <button onClick={() => setViewMode('preview')} className={`tb-btn mode-btn ${viewMode === 'preview' ? 'active' : ''}`}>Preview</button>
          <button onClick={() => setViewMode('split')} className={`tb-btn mode-btn ${viewMode === 'split' ? 'active' : ''} desktop-only`}>Split</button>
        </div>

        <div className="toolbar-group actions" style={{ marginLeft: 'auto' }}>
          <button onClick={handleSave} disabled={saving} className="btn">
            {saving ? 'Saving...' : 'Save (⌘S)'}
          </button>
        </div>
      </div>

      {/* Editor Main Content Workspace */}
      <div className={`ideas-workspace mode-${viewMode}`}>
        {loading ? (
          <div className="ideas-loading" style={{ width: '100%' }}>
            <div className="spinner"></div>
            <span>Opening file...</span>
          </div>
        ) : (
          <>
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className="workspace-panel edit-panel">
                <textarea
                  ref={textareaRef}
                  className="ideas-textarea"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your ideas, notes, or brainstorming specs here using Markdown..."
                />
              </div>
            )}

            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className="workspace-panel preview-panel">
                {content ? (
                  <div
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{ __html: compileMarkdown(content) }}
                  />
                ) : (
                  <div className="preview-empty">Nothing to preview yet. Write some Markdown to see it rendered here.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
