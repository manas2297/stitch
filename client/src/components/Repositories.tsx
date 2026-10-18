import { Globe, Laptop, Plus, Star, Target, X } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { confirmDialog } from '../helper/confirm';
import useAppStore from '../store/useAppStore';
import PageHeader from './layout/PageHeader';
import { useToast } from './Toast';

export default function Repositories() {
  const toast = useToast();
  const repos = useAppStore((s) => s.repos);
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <section id="repositories-section">
      <PageHeader
        title="Repositories Manager"
        description="Add, configure, and manage your tracked local and web projects."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Add repository card */}
        <Card className="min-h-40 justify-between border-dashed bg-transparent shadow-none">
          <CardContent className="flex h-full flex-col justify-between gap-4">
            <div>
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                <Plus className="size-3.5" /> Add Repository
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Add local folder paths (e.g. <code className="bg-muted rounded px-1">/Users/name/repo</code>) or remote
                targets (e.g. <code className="bg-muted rounded px-1">owner/name</code>) to start managing.
              </p>
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const input = (e.target as HTMLFormElement).elements.namedItem('repoPathInput') as HTMLInputElement;
                const pathVal = input.value.trim();
                if (!pathVal) return;
                try {
                  await useAppStore.getState().addRepo(pathVal);
                  input.value = '';
                  toast('Repository added successfully', 'success');
                } catch (err) {
                  toast(err.message, 'error');
                }
              }}
            >
              <Input name="repoPathInput" type="text" placeholder="Path or owner/repo..." required />
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>

        {repos.map((repo) => {
          const isLocal = repo.type === 'local';
          const isExternal =
            !repo.owner || !currentUser || repo.owner.toLowerCase() !== currentUser.toLowerCase();
          const key = repo.path || `${repo.owner}/${repo.name}`;

          return (
            <Card key={key} className="min-h-40 justify-between">
              <CardContent className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 font-bold">
                    {isLocal ? <Laptop className="size-4 shrink-0" /> : <Globe className="size-4 shrink-0" />}
                    <span className="truncate">{repo.name}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Badge variant={isExternal ? 'orange' : 'purple'} className="text-[0.65rem] normal-case">
                      {isExternal ? 'External' : 'My Repo'}
                    </Badge>
                    {isLocal && !repo.exists && (
                      <Badge variant="red" className="text-[0.65rem]">
                        Missing
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-muted-foreground font-mono text-xs break-all">
                  {isLocal ? repo.path : `${repo.owner}/${repo.name}`}
                </div>

                {isLocal && repo.exists && (
                  <div className="text-muted-foreground text-xs">
                    Active Branch: <strong className="text-foreground">{repo.branch || 'main'}</strong>
                  </div>
                )}
              </CardContent>

              <CardContent className="flex gap-2 border-t pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    useAppStore.getState().setFocusProject(repo.path || `${repo.owner}/${repo.name}`);
                    useAppStore.getState().setActiveTab('focus');
                    toast(`Focused workspace set to ${repo.name}`, 'info');
                  }}
                >
                  <Target /> Focus
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className={cn(repo.isMajorProject && 'text-[var(--energy-medium)]')}
                  onClick={() => {
                    useAppStore.getState().toggleMajor({
                      path: repo.path || '',
                      owner: repo.owner || '',
                      name: repo.name || '',
                    });
                    toast(
                      repo.isMajorProject
                        ? `${repo.name} removed from Major Projects`
                        : `${repo.name} added to Major Projects ⭐`,
                      repo.isMajorProject ? 'info' : 'success',
                    );
                  }}
                >
                  <Star className={cn(repo.isMajorProject && 'fill-current')} />
                  {repo.isMajorProject ? 'Starred' : 'Star'}
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${repo.name}`}
                  onClick={async () => {
                    const confirmed = await confirmDialog('Remove Repository', `Remove repository: ${repo.name}?`);
                    if (!confirmed) return;
                    try {
                      await useAppStore.getState().deleteRepo({
                        path: repo.path || '',
                        owner: repo.owner || '',
                        name: repo.name || '',
                      });
                      toast(`Removed ${repo.name}`, 'info');
                    } catch (err) {
                      toast(err.message, 'error');
                    }
                  }}
                >
                  <X />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
