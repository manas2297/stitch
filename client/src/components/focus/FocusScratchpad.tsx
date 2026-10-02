import { useState, useEffect } from 'react';

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
    <div className="focus-card scratchpad-card">
      <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📝 Focus Scratchpad</span>
        <button
          className="btn btn-secondary"
          style={{ padding: '2px 8px', fontSize: '0.75rem' }}
          onClick={() => handleScratchpadChange('')}
          title="Clear notes"
        >
          Clear
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
        <span style={{ color: '#818cf8' }}>Auto-saved</span>
      </div>
    </div>
  );
}
