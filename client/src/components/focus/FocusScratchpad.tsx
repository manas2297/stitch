import { useState, useEffect } from 'react';
import { FileText, Eraser } from 'lucide-react';

interface FocusScratchpadProps {
  focusProject: string;
}

export default function FocusScratchpad({ focusProject }: FocusScratchpadProps) {
  const [scratchpadText, setScratchpadText] = useState('');

  useEffect(() => {
    if (!focusProject) return;
    const savedText = localStorage.getItem(`stitch_scratchpad_${focusProject}`);
    setScratchpadText(savedText || '');
  }, [focusProject]);

  const handleScratchpadChange = (text: string) => {
    setScratchpadText(text);
    if (focusProject) {
      localStorage.setItem(`stitch_scratchpad_${focusProject}`, text);
    }
  };

  return (
    <div className="focus-card scratchpad-card" style={{ padding: '1.5rem' }}>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <span>Focus Scratchpad</span>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          style={{
            padding: '3px 8px',
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
          onClick={() => handleScratchpadChange('')}
          title="Clear notes"
        >
          <Eraser size={13} />
          <span>Clear</span>
        </button>
      </h3>
      <textarea
        className="scratchpad-textarea"
        placeholder="Jot down quick thoughts, snippets, or todo items for this workspace..."
        value={scratchpadText}
        onChange={(e) => handleScratchpadChange(e.target.value)}
      />
      <div className="scratchpad-meta">
        <span>
          {scratchpadText.trim() ? scratchpadText.trim().split(/\s+/).length : 0} words • {scratchpadText.length} chars
        </span>
        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Auto-saved</span>
      </div>
    </div>
  );
}
