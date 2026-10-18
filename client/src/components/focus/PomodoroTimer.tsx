import { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FocusCard from './FocusCard';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroTimerProps {
  onSessionComplete?: () => void;
}

const DURATIONS: Record<TimerMode, number> = { work: 25, shortBreak: 5, longBreak: 15 };

export default function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [timerMode, setTimerMode] = useState<TimerMode>('work');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATIONS.work * 60);
  const [completedSessions, setCompletedSessions] = useState(() => {
    const saved = localStorage.getItem('stitch_focus_completed_sessions');
    return saved ? parseInt(saved, 10) : 0;
  });

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio play blocked
    }
  };

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          playChime();
          if (timerMode === 'work') {
            setCompletedSessions((c) => {
              const next = c + 1;
              localStorage.setItem('stitch_focus_completed_sessions', next.toString());
              return next;
            });
            onSessionComplete?.();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode, onSessionComplete]);

  const switchTimerMode = (mode: TimerMode) => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimeLeft(DURATIONS[mode] * 60);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(DURATIONS[timerMode] * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <FocusCard icon={Timer} title="Focus Timer">
      <div className="flex flex-col gap-4">
        <Tabs value={timerMode} onValueChange={(v) => switchTimerMode(v as TimerMode)}>
          <TabsList className="grid h-auto w-full grid-cols-3">
            <TabsTrigger value="work" className="px-1 text-xs">
              Focus (25m)
            </TabsTrigger>
            <TabsTrigger value="shortBreak" className="px-1 text-xs">
              Short (5m)
            </TabsTrigger>
            <TabsTrigger value="longBreak" className="px-1 text-xs">
              Long (15m)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="bg-muted/40 rounded-xl border py-6 text-center">
          <div className="font-mono text-5xl font-bold tracking-tight tabular-nums" role="timer" aria-live="off">
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setIsTimerRunning(!isTimerRunning)}>
            {isTimerRunning ? <Pause /> : <Play />} {isTimerRunning ? 'Pause' : 'Start'}
          </Button>
          <Button variant="secondary" onClick={resetTimer}>
            <RotateCcw /> Reset
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5 text-amber-600" /> Sessions Completed:{' '}
            <strong className="text-primary">{completedSessions}</strong>
          </span>
          <span className="text-muted-foreground text-xs">{timerMode === 'work' ? 'Stay Focused' : 'Take a Break'}</span>
        </div>
      </div>
    </FocusCard>
  );
}
