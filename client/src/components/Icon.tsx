import {
  ArrowLeftRight,
  BarChart3,
  Eye,
  FolderGit2,
  Hammer,
  Home,
  ListChecks,
  Shapes,
  Tag,
  TriangleAlert,
  User,
  type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  overview: Home,
  repositories: FolderGit2,
  focus: Eye,
  projects: ListChecks,
  releases: Tag,
  'pr-reviews': ArrowLeftRight,
  issues: TriangleAlert,
  builds: Hammer,
  profile: User,
  'gemini-monitor': BarChart3,
  architecture: Shapes,
};

export default function Icon({ name, className = '', size = 18 }) {
  const Glyph = icons[name];
  if (!Glyph) return null;
  return <Glyph className={className} size={size} aria-hidden />;
}
