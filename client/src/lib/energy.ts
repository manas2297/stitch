import { Flame, Menu, Sun, Zap, type LucideIcon } from 'lucide-react';

export type EnergyMode = 'all' | 'low' | 'medium' | 'high';

export interface EnergyConfig {
  label: string;
  desc: string;
  color: string;
  icon: LucideIcon;
  badge: 'default' | 'blue' | 'orange' | 'red';
}

export const ENERGY_CONFIG: Record<EnergyMode, EnergyConfig> = {
  all: {
    label: 'All Modes',
    desc: 'Show every section regardless of energy level.',
    color: 'var(--foreground)',
    icon: Menu,
    badge: 'default',
  },
  low: {
    label: 'Low Energy',
    desc: 'Light review & triage tasks. Easy focus.',
    color: 'var(--energy-low)',
    icon: Sun,
    badge: 'blue',
  },
  medium: {
    label: 'Medium Energy',
    desc: 'Releases, projects & balanced workload.',
    color: 'var(--energy-medium)',
    icon: Zap,
    badge: 'orange',
  },
  high: {
    label: 'High Energy',
    desc: 'Deep work: builds, focus, and active dev.',
    color: 'var(--energy-high)',
    icon: Flame,
    badge: 'red',
  },
};
