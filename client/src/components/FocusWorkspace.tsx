import { useEffect, useState } from 'react';
import {
  Bot,
  ExternalLink,
  FileCode,
  FileText,
  Folder,
  FolderTree,
  GitBranch,
  GitPullRequest,
  Globe,
  Lightbulb,
  Play,
  Target,
  type LucideIcon,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useAppStore, { apiFetch } from '../store/useAppStore';
import FocusCard from './focus/FocusCard';
import FocusChecklist from './focus/FocusChecklist';
import FocusScratchpad from './focus/FocusScratchpad';
import PomodoroTimer from './focus/PomodoroTimer';
import LoadingState, { ErrorMessage } from './layout/LoadingState';
import PageHeader from './layout/PageHeader';

function IssueRow({ number, url, title, author, trailing, tone }: {
  number: number;
  url: string;
  title: string;
  author?: string;
  trailing?: React.ReactNode;
  tone: 'orange' | 'blue';
}) {
  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Badge variant={tone} className="shrink-0 px-1.5 py-0.5 text-[0.7rem]">
          #{number}
        </Badge>
        <a href={url} target="_blank" rel="noreferrer" className="hover:text-primary min-w-0 font-medium break-words">
          {title}
        </a>
      </div>
      <div className="text-muted-foreground flex shrink-0 items-center gap-2.5 pl-1 text-xs sm:pl-0">
        {author && <span>by @{author}</span>}
        {trailing}
      </div>
    </div>
  );
}

function ProjectSelect({ repos, value, onChange }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72" aria-label="Active project">
        <SelectValue placeholder="-- Select Active Project --" />
      </SelectTrigger>
      <SelectContent>
        {repos.map((repo) => {
          const v = repo.path || `${repo.owner}/${repo.name}`;
          return (
            <SelectItem key={v} value={v}>
              [{repo.type === 'local' ? 'Local' : 'GitHub'}] {repo.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default function FocusWorkspace() {
  const { repos, focusProject, setFocusProject } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerItems, setExplorerItems] = useState<any[]>([]);
  const [fileViewer, setFileViewer] = useState<{ path: string; content: string } | null>(null);
  const [botOutput, setBotOutput] = useState('');
  const [botRunning, setBotRunning] = useState(false);

  useEffect(() => {
    if (!focusProject) {
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    setExplorerPath('');
    setFileViewer(null);
    apiFetch('/api/focus/info')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [focusProject]);

  useEffect(() => {
    if (data && data.active && data.type !== 'local') loadDir('');
  }, [data]);

  const loadDir = async (path: string) => {
    if (!data) return;
    setExplorerPath(path);
    setFileViewer(null);
    const res = await apiFetch(
      `/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`,
    );
    const items = await res.json();
    if (Array.isArray(items)) {
      items.sort((a, b) => (b.type === 'dir' ? 1 : 0) - (a.type === 'dir' ? 1 : 0));
      setExplorerItems(items);
    }
  };

  const loadFile = async (path: string) => {
    setFileViewer({ path, content: 'Loading…' });
    const res = await apiFetch(
      `/api/focus/contents?owner=${data.repo.owner}&name=${data.repo.name}&path=${encodeURIComponent(path)}`,
    );
    const fd = await res.json();
    setFileViewer({ path, content: fd.decodedContent ?? 'Binary or too large to display.' });
  };

  const runBotAudit = () => {
    setBotOutput('Analyzing repository build… [SSE stream started]\n');
    setBotRunning(true);
    const script = data.repo.buildScripts?.includes('lint')
      ? 'lint'
      : data.repo.buildScripts?.includes('build')
        ? 'build'
        : '';

    const isDesktop = (window as any).go !== undefined || import.meta.env.PROD;
    const baseUrl = isDesktop ? 'http://127.0.0.1:4000' : '';

    const es = new EventSource(
      `${baseUrl}/api/build/run?path=${encodeURIComponent(data.repo.path)}&script=${encodeURIComponent(script)}`,
    );
    es.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.log) setBotOutput((prev) => prev + d.log);
      if (d.done) {
        es.close();
        setBotRunning(false);
        setBotOutput((prev) => prev + `\n[SYSTEM] Exit code ${d.exitCode}\n`);
      }
    };
    es.onerror = () => {
      es.close();
      setBotRunning(false);
      setBotOutput((prev) => prev + '\n[ERROR] Connection failed.\n');
    };
  };

  const breadcrumbParts = explorerPath.split('/').filter(Boolean);

  const header = (
    <PageHeader
      title="Focus Area Workspace"
      description="Zero in on your active repository context."
      actions={<ProjectSelect repos={repos} value={focusProject} onChange={setFocusProject} />}
    />
  );

  if (!focusProject) {
    return (
      <section id="focus-section">
        {header}
        <EmptyState
          icon={Target}
          title="No Active Project in Focus"
          description="Select a repository from the dropdown above to start working in the Focus Workspace."
        />
      </section>
    );
  }

  const ready = data && data.active && !loading;
  const isLocal = ready && data.type === 'local';
  const issuesList = ready && Array.isArray(data.issues) ? data.issues : [];
  const features = issuesList.filter((i: any) => i.labels?.some((l: any) => /feature|enhancement/i.test(l.name)));
  const prs = ready && Array.isArray(data.prs) ? data.prs : [];

  return (
    <section id="focus-section">
      {header}

      {loading && <LoadingState label="Retrieving Workspace Context…" />}
      {error && <ErrorMessage>Failed to load focus workspace: {error}</ErrorMessage>}

      {ready && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <FocusCard
              icon={Lightbulb}
              iconClassName="text-amber-600 dark:text-amber-400"
              title="Features to Work On"
              badge={features.length > 0 && <Badge variant="orange">{features.length}</Badge>}
            >
              {features.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {features.map((f: any) => (
                    <IssueRow
                      key={f.number}
                      number={f.number}
                      url={f.url}
                      title={f.title}
                      author={f.author?.login}
                      tone="orange"
                      trailing={<Badge variant="purple">Feature</Badge>}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Lightbulb}
                  title="No active feature issues"
                  description="Issues labeled 'feature' or 'enhancement' will appear here."
                />
              )}
            </FocusCard>

            <FocusChecklist focusProject={focusProject} />

            <FocusCard
              icon={GitPullRequest}
              title="Pull Request Reviews"
              badge={prs.length > 0 && <Badge variant="blue">{prs.length}</Badge>}
            >
              {prs.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {prs.map((pr: any) => (
                    <IssueRow key={pr.number} number={pr.number} url={pr.url} title={pr.title} author={pr.author?.login} tone="blue" />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={GitPullRequest}
                  title="No active pull requests"
                  description="Open pull requests will be listed here for quick review."
                />
              )}
            </FocusCard>

            {fileViewer && (
              <FocusCard
                icon={FileCode}
                title={fileViewer.path.split('/').pop()}
                action={
                  <Button variant="secondary" size="xs" onClick={() => setFileViewer(null)}>
                    Close Viewer
                  </Button>
                }
              >
                <pre className="bg-muted/50 max-h-96 overflow-auto rounded-lg border p-3.5 font-mono text-xs break-words whitespace-pre-wrap">
                  <code>{fileViewer.content}</code>
                </pre>
              </FocusCard>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <PomodoroTimer />
            <FocusScratchpad focusProject={focusProject} />

            {isLocal ? (
              <>
                <FocusCard icon={GitBranch} title="Local Git State">
                  <div className="text-muted-foreground mb-3 text-sm">
                    Branch: <strong className="text-foreground">{data.repo?.branch || 'main'}</strong>
                  </div>
                  {data.localStatus && data.localStatus.length > 0 ? (
                    <div className="bg-muted/50 max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs">
                      {data.localStatus.map((s: string, i: number) => (
                        <div key={i}>{s}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Working directory clean.</p>
                  )}
                </FocusCard>

                <FocusCard icon={Bot} title="Bot Review Diagnostics">
                  <p className="text-muted-foreground mb-3 text-sm">Run a local validation script to audit build health.</p>
                  <Button className="w-full" onClick={runBotAudit} disabled={botRunning}>
                    <Play /> {botRunning ? 'Running…' : 'Run Build Audit'}
                  </Button>
                  {botOutput && (
                    <pre className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs break-words whitespace-pre-wrap text-sky-400">
                      {botOutput}
                    </pre>
                  )}
                </FocusCard>
              </>
            ) : (
              <>
                <FocusCard icon={Globe} title="Remote Repository Context">
                  <p className="text-muted-foreground text-sm leading-snug">
                    Remote GitHub repository. Local commands are disabled for web projects.
                  </p>
                  <Button asChild className="mt-3 w-full">
                    <a href={`https://github.com/${data.repo.owner}/${data.repo.name}`} target="_blank" rel="noreferrer">
                      View on GitHub <ExternalLink />
                    </a>
                  </Button>
                </FocusCard>

                <FocusCard icon={FolderTree} title="Remote File Explorer">
                  <div className="mb-2.5 flex flex-wrap items-center gap-1 text-xs">
                    <button type="button" className="text-primary font-semibold hover:underline" onClick={() => loadDir('')}>
                      root
                    </button>
                    {breadcrumbParts.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1">
                        <span className="text-muted-foreground">/</span>
                        <button
                          type="button"
                          className="text-primary font-semibold hover:underline"
                          onClick={() => loadDir(breadcrumbParts.slice(0, i + 1).join('/'))}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  </div>
                  <ul className="bg-muted/30 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-lg border p-2 text-sm">
                    {explorerItems.map((item) => {
                      const Icon: LucideIcon = item.type === 'dir' ? Folder : FileText;
                      return (
                        <li key={item.path}>
                          <button
                            type="button"
                            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
                            onClick={() => (item.type === 'dir' ? loadDir(item.path) : loadFile(item.path))}
                          >
                            <Icon className={item.type === 'dir' ? 'text-primary size-4 shrink-0' : 'text-muted-foreground size-4 shrink-0'} />
                            <span className="truncate">{item.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </FocusCard>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
