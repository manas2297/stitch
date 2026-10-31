import { useState } from "react";
import { Bot, GitBranch, GitPullRequest, Lightbulb, Play } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { runBuild } from "@/lib/desktop";
import FocusCard from "./FocusCard";

/** GitHub features and PRs, local git state, build audit and file explorer for the focused repo. */
function IssueRow({
  number,
  url,
  title,
  author,
  trailing,
  tone,
}: {
  number: number;
  url: string;
  title: string;
  author?: string;
  trailing?: React.ReactNode;
  tone: "orange" | "blue";
}) {
  return (
    <div className="bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Badge variant={tone} className="shrink-0 px-1.5 py-0.5 text-[0.7rem]">
          #{number}
        </Badge>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary min-w-0 font-medium break-words"
        >
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

export default function RepoContext({ data }: { data: any }) {
  const [botOutput, setBotOutput] = useState("");
  const [botRunning, setBotRunning] = useState(false);

  const runBotAudit = () => {
    setBotOutput("Analyzing repository build… [SSE stream started]\n");
    setBotRunning(true);
    const script = data.repo.buildScripts?.includes("lint")
      ? "lint"
      : data.repo.buildScripts?.includes("build")
        ? "build"
        : "";

    runBuild(data.repo.path, script, (d) => {
      if (d.log) setBotOutput((prev) => prev + d.log);
      if (d.done) {
        setBotRunning(false);
        setBotOutput((prev) => prev + `\n[SYSTEM] Exit code ${d.exitCode}\n`);
      }
    });
  };

  // /api/focus/info reports `type: true` for local repositories.
  const isLocal = data.type === true;
  const issuesList = Array.isArray(data.issues) ? data.issues : [];
  const features = issuesList.filter((i: any) =>
    i.labels?.some((l: any) => /feature|enhancement/i.test(l.name)),
  );
  const prs = Array.isArray(data.prs) ? data.prs : [];

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <FocusCard
          icon={Lightbulb}
          iconClassName="text-amber-600 dark:text-amber-400"
          title="Features to Work On"
          badge={
            features.length > 0 && (
              <Badge variant="orange">{features.length}</Badge>
            )
          }
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

        <FocusCard
          icon={GitPullRequest}
          title="Pull Request Reviews"
          badge={prs.length > 0 && <Badge variant="blue">{prs.length}</Badge>}
        >
          {prs.length > 0 ? (
            <div className="flex flex-col gap-2">
              {prs.map((pr: any) => (
                <IssueRow
                  key={pr.number}
                  number={pr.number}
                  url={pr.url}
                  title={pr.title}
                  author={pr.author?.login}
                  tone="blue"
                />
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
      </div>

      {isLocal && (
        <div className="flex min-w-0 flex-col gap-6">
          <FocusCard icon={GitBranch} title="Local Git State">
            <div className="text-muted-foreground mb-3 text-sm">
              Branch:{" "}
              <strong className="text-foreground">
                {data.repo?.branch || "main"}
              </strong>
            </div>
            {data.localStatus && data.localStatus.length > 0 ? (
              <div className="bg-muted/50 max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs">
                {data.localStatus.map((s: string, i: number) => (
                  <div key={i}>{s}</div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Working directory clean.
              </p>
            )}
          </FocusCard>

          <FocusCard icon={Bot} title="Bot Review Diagnostics">
            <p className="text-muted-foreground mb-3 text-sm">
              Run a local validation script to audit build health.
            </p>
            <Button
              className="w-full"
              onClick={runBotAudit}
              disabled={botRunning}
            >
              <Play /> {botRunning ? "Running…" : "Run Build Audit"}
            </Button>
            {botOutput && (
              <pre className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs break-words whitespace-pre-wrap text-sky-400">
                {botOutput}
              </pre>
            )}
          </FocusCard>
        </div>
      )}
    </div>
  );
}
