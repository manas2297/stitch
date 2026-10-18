import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Globe, Laptop } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '../store/useAppStore';
import IdeasEditor from './IdeasEditor';
import LoadingState, { ErrorMessage } from './layout/LoadingState';
import Roadmap from './Roadmap';

const TABS = [
  { id: 'features', label: '💡 Features' },
  { id: 'bugs', label: '🐛 Bugs' },
  { id: 'reviews', label: '👀 Reviews' },
  { id: 'closed-prs', label: '✅ Closed PRs' },
  { id: 'ideas', label: '🧠 Ideas' },
  { id: 'issues', label: '📋 Issues' },
  { id: 'roadmap', label: '🗺️ Roadmap' },
];

const Empty = ({ children }) => <p className="text-muted-foreground py-4 text-sm">{children}</p>;

function Row({
  url,
  number,
  title,
  author,
  createdAt,
  trailing = null,
  children = null,
}: {
  url: string;
  number: number;
  title: string;
  author?: string;
  createdAt: string;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <a href={url} target="_blank" rel="noreferrer" className="hover:text-primary font-semibold break-words">
          <span className="text-muted-foreground">#{number}</span> {title}
        </a>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          by @{author || '?'} · {new Date(createdAt).toLocaleDateString()}
          {children}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

function IssueList({ items, emptyMsg }) {
  if (!items || items.length === 0) return <Empty>{emptyMsg}</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {items.map((issue) => (
        <Row key={issue.number} url={issue.url} number={issue.number} title={issue.title} author={issue.author?.login} createdAt={issue.createdAt}>
          {issue.labels.map((l) => (
            <Badge key={l.name} className="border text-[0.68rem] normal-case">
              {l.name}
            </Badge>
          ))}
        </Row>
      ))}
    </div>
  );
}

function PRList({ prs }) {
  if (!prs || prs.length === 0) return <Empty>No pull requests found.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {prs.map((pr) => {
        let status = <Badge variant="blue">Open</Badge>;
        if (pr.state === 'MERGED') status = <Badge variant="purple">Merged</Badge>;
        else if (pr.state === 'CLOSED') status = <Badge variant="red">Closed</Badge>;
        else if (pr.reviewRequests?.length > 0) status = <Badge variant="orange">Review Requested</Badge>;
        return (
          <Row key={pr.number} url={pr.url} number={pr.number} title={pr.title} author={pr.author?.login} createdAt={pr.createdAt} trailing={status} />
        );
      })}
    </div>
  );
}

export default function ProjectDetail({ repo, onBack }) {
  const [details, setDetails] = useState(null);
  const [roadmap, setRoadmap] = useState({ tasks: [], issue: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`).then((r) => r.json()),
      apiFetch(`/api/roadmap?owner=${repo.owner}&name=${repo.name}`).then((r) => r.json()),
    ])
      .then(([d, rm]) => {
        setDetails(d);
        setRoadmap(rm);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [repo.owner, repo.name]);

  if (loading) return <LoadingState label={`Loading ${repo.name} workspace…`} />;

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorMessage>Failed to load project details: {error}</ErrorMessage>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
      </div>
    );
  }

  const prs = details.prs || [];
  const openPrs = prs.filter((pr) => pr.state === 'OPEN');
  const closedPrs = prs.filter((pr) => pr.state === 'CLOSED' || pr.state === 'MERGED');
  const tabCounts = {
    features: details.features.length,
    bugs: details.bugs.length,
    reviews: openPrs.length,
    'closed-prs': closedPrs.length,
    ideas: '✎',
    issues: details.general.length,
    roadmap: roadmap.tasks.length,
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" onClick={onBack} className="self-start">
          <ArrowLeft /> Back
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {repo.type === 'local' ? <Laptop className="size-5" /> : <Globe className="size-5" />}
            <span className="truncate">{repo.name}</span>
          </h2>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-sm">
            <span>
              {repo.owner}/{repo.name}
            </span>
            <span aria-hidden>·</span>
            <span>
              Last release: <strong className="text-[var(--energy-medium)]">{details.lastTag}</strong>
            </span>
          </div>
        </div>
        <Button variant="secondary" asChild>
          <a href={`https://github.com/${repo.owner}/${repo.name}`} target="_blank" rel="noreferrer">
            View on GitHub <ExternalLink />
          </a>
        </Button>
      </div>

      <Tabs defaultValue="features">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="h-auto w-max justify-start">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2 px-3 py-1.5">
                {tab.label}
                <span className="bg-background/70 rounded-full px-1.5 text-[0.7rem]">{tabCounts[tab.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="features" className="mt-4">
          <IssueList
            items={details.features}
            emptyMsg='No feature issues found. Label a GitHub issue with "feature" or "enhancement" to see it here.'
          />
        </TabsContent>
        <TabsContent value="bugs" className="mt-4">
          <IssueList items={details.bugs} emptyMsg="No bug issues found. Great news! 🎉" />
        </TabsContent>
        <TabsContent value="reviews" className="mt-4">
          <PRList prs={openPrs} />
        </TabsContent>
        <TabsContent value="closed-prs" className="mt-4">
          <PRList prs={closedPrs} />
        </TabsContent>
        <TabsContent value="ideas" className="mt-4">
          <IdeasEditor owner={repo.owner} name={repo.name} />
        </TabsContent>
        <TabsContent value="issues" className="mt-4">
          <IssueList items={details.general} emptyMsg="No general open issues." />
        </TabsContent>
        <TabsContent value="roadmap" className="mt-4">
          <Roadmap owner={repo.owner} name={repo.name} initialTasks={roadmap.tasks} issue={roadmap.issue} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
