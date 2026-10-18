import { useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useAppStore from '../store/useAppStore';
import PageHeader from './layout/PageHeader';
import { useToast } from './Toast';

export default function Builds() {
  const toast = useToast();
  const repos = useAppStore((s) => s.repos);
  const localRepos = repos.filter((r) => r.exists && r.type === 'local');

  const [selectedPath, setSelectedPath] = useState('');
  const [scripts, setScripts] = useState(['build']);
  const [selectedScript, setSelectedScript] = useState('build');
  const [output, setOutput] = useState('Console is idle. Select a repository and task to run.');
  const [status, setStatus] = useState('Terminal Offline');
  const [running, setRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const handleRepoChange = (path: string) => {
    setSelectedPath(path);
    const repo = repos.find((r) => r.path === path);
    const buildScripts = repo?.buildScripts?.length > 0 ? repo.buildScripts : ['build'];
    setScripts(buildScripts);
    setSelectedScript(buildScripts[0]);
  };

  const runTask = () => {
    if (running) {
      esRef.current?.close();
      esRef.current = null;
      setRunning(false);
      setStatus('Task Aborted');
      setOutput((prev) => prev + '\n\n[SYSTEM] Task execution terminated by user.\n');
      return;
    }
    if (!selectedPath) {
      toast('Please select a local repository.', 'warning');
      return;
    }

    setOutput('');
    setStatus('Running…');
    setRunning(true);

    const es = new EventSource(
      `/api/build/run?path=${encodeURIComponent(selectedPath)}&script=${encodeURIComponent(selectedScript)}`,
    );
    esRef.current = es;

    es.onmessage = (event) => {
      const d = JSON.parse(event.data);
      if (d.log) setOutput((prev) => prev + d.log);
      if (d.done) {
        es.close();
        esRef.current = null;
        setRunning(false);
        setStatus(`Finished (Code: ${d.exitCode})`);
        setOutput((prev) => prev + `\n\n[SYSTEM] Build process exited with code ${d.exitCode}\n`);
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
      setRunning(false);
      setStatus('Connection Error');
      setOutput((prev) => prev + '\n[SYSTEM ERROR] Connection to server lost.\n');
    };
  };

  return (
    <section id="builds-section">
      <PageHeader
        title="Fix Builds"
        description="Select a repository to run build commands and view diagnostic outputs."
        actions={
          <Select value={selectedPath} onValueChange={handleRepoChange}>
            <SelectTrigger className="w-full min-w-56 sm:w-64" aria-label="Local repository">
              <SelectValue placeholder="Select a local repository…" />
            </SelectTrigger>
            <SelectContent>
              {localRepos.map((r) => (
                <SelectItem key={r.path} value={r.path}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedScript} onValueChange={setSelectedScript}>
            <SelectTrigger className="w-40" aria-label="Task">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scripts.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant={running ? 'secondary' : 'default'} onClick={runTask}>
            {running ? <Square /> : <Play />}
            {running ? 'Stop Task' : 'Run Task'}
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border bg-slate-950 text-slate-100 shadow-sm">
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5 text-xs text-slate-400">
            <div className="flex gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-red-400/80" />
              <span className="size-2.5 rounded-full bg-amber-400/80" />
              <span className="size-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span>{status}</span>
          </div>
          <pre className="max-h-[60vh] min-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      </div>
    </section>
  );
}
