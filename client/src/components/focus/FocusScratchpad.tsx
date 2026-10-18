import { useEffect, useState } from 'react';
import { Eraser, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import FocusCard from './FocusCard';

interface FocusScratchpadProps {
  focusProject: string;
}

export default function FocusScratchpad({ focusProject }: FocusScratchpadProps) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!focusProject) return;
    setText(localStorage.getItem(`stitch_scratchpad_${focusProject}`) || '');
  }, [focusProject]);

  const handleChange = (value: string) => {
    setText(value);
    if (focusProject) localStorage.setItem(`stitch_scratchpad_${focusProject}`, value);
  };

  return (
    <FocusCard
      icon={FileText}
      title="Focus Scratchpad"
      action={
        <Button type="button" variant="secondary" size="xs" onClick={() => handleChange('')} title="Clear notes">
          <Eraser /> Clear
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Textarea
          className="min-h-32 resize-y"
          placeholder="Jot down quick thoughts, snippets, or todo items for this workspace..."
          value={text}
          onChange={(e) => handleChange(e.target.value)}
        />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>
            {text.trim() ? text.trim().split(/\s+/).length : 0} words • {text.length} chars
          </span>
          <span className="text-primary font-semibold">Auto-saved</span>
        </div>
      </div>
    </FocusCard>
  );
}
