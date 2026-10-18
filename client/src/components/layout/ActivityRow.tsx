import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';

import { AgeBadge } from '@/components/ui/AgeBadge';

/** Row used by PR and issue lists. */
export default function ActivityRow({
  url,
  repoName,
  number,
  title,
  author,
  createdAt,
  extra,
  trailing,
}: {
  url: string;
  repoName?: string;
  number: number;
  title: string;
  author?: string;
  createdAt: string;
  extra?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="bg-card hover:border-ring/40 flex flex-col gap-2 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary inline-flex max-w-full items-baseline gap-1 font-semibold"
        >
          <span className="break-words">
            {repoName && <span className="text-muted-foreground mr-1 font-medium">[{repoName}]</span>}#{number} {title}
          </span>
          <ExternalLink className="text-muted-foreground size-3 shrink-0" aria-hidden />
        </a>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {author && <span className="text-muted-foreground text-xs">@{author}</span>}
          <AgeBadge date={createdAt} />
          {extra}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
