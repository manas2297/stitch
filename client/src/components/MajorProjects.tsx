import { useEffect, useState } from 'react';
import { ArrowRight, Globe, Laptop, Star, Target } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import useAppStore, { apiFetch } from '../store/useAppStore';
import PageHeader from './layout/PageHeader';
import ProjectDetail from './ProjectDetail';

function Stat({ value, label, className }: { value: number | string; label: string; className?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg px-2 py-2.5 text-center">
      <div className={cn('text-xl font-extrabold', className)}>{value}</div>
      <div className="text-muted-foreground text-[0.65rem] font-medium tracking-wider uppercase">{label}</div>
    </div>
  );
}

export default function MajorProjects() {
  const repos = useAppStore((s) => s.repos);
  const [selectedProject, setSelectedProject] = useState(null);
  const [stats, setStats] = useState({});

  const majorRepos = repos.filter((r) => r.isMajorProject);

  // Fetch stats for each major project whenever the list changes
  useEffect(() => {
    majorRepos.forEach((repo) => {
      if (!repo.owner || !repo.name) return;
      const key = `${repo.owner}/${repo.name}`;
      if (stats[key]) return; // already loaded
      apiFetch(`/api/projects/details?owner=${repo.owner}&name=${repo.name}`)
        .then((r) => r.json())
        .then((d) => setStats((prev) => ({ ...prev, [key]: d })))
        .catch(() => {});
    });
  }, [majorRepos.length]);

  if (selectedProject) {
    return <ProjectDetail repo={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <section id="projects-section">
      <PageHeader
        title="Major Projects"
        description="Track and prioritize key repositories you've designated as major projects."
      />

      {majorRepos.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No Major Projects yet"
          description="Star any repository on the Repositories page to track it here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {majorRepos.map((repo) => {
            const key = `${repo.owner}/${repo.name}`;
            const s = stats[key];
            const count = (list: unknown[] | undefined) => (s ? (list?.length ?? 0) : '—');

            return (
              <Card
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedProject(repo)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedProject(repo)}
                className="hover:border-primary/40 focus-visible:ring-ring/50 group cursor-pointer outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px]"
              >
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-lg font-bold">
                        {repo.type === 'local' ? <Laptop className="size-4 shrink-0" /> : <Globe className="size-4 shrink-0" />}
                        <span className="truncate">{repo.name}</span>
                      </div>
                      <div className="text-muted-foreground mt-1 truncate text-xs">
                        {repo.owner || 'local'}/{repo.name}
                      </div>
                    </div>
                    <Badge variant="green" className="shrink-0">
                      <Star className="fill-current" /> Major
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <Stat value={count(s?.features)} label="Features" className="text-purple-500" />
                    <Stat value={count(s?.bugs)} label="Bugs" className="text-destructive" />
                    <Stat value={count(s?.prs)} label="PRs" className="text-[var(--energy-low)]" />
                    <Stat value={count(s?.general)} label="Issues" className="text-muted-foreground" />
                  </div>

                  <div className="text-muted-foreground group-hover:text-primary flex items-center gap-1 text-xs transition-colors">
                    Open project workspace <ArrowRight className="size-3" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
