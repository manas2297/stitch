import { useState, useEffect } from 'react';

interface PomodoroTimerProps {
  onSessionComplete?: () => void;
}

export default function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const [timerMode, setTimerMode] = useState<'work' | 'shortBreak' | 'longBreak'>('work');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [durations] = useState({ work: 25, shortBreak: 5, longBreak: 15 });
  const [timeLeft, setTimeLeft] = useState(25 * 60);
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
    } catch (e) {
      // Audio play blocked
    }
  };

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
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
              if (onSessionComplete) onSessionComplete();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerMode, onSessionComplete]);

  const switchTimerMode = (mode: 'work' | 'shortBreak' | 'longBreak') => {
    setIsTimerRunning(false);
    setTimerMode(mode);
    setTimeLeft(durations[mode] * 60);
  };

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimeLeft(durations[timerMode] * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="focus-card pomodoro-card">
      <h3><span>⏱️</span> Focus Timer</h3>
      <div className="pomodoro-modes">
        <button
          className={`pomodoro-mode-btn ${timerMode === 'work' ? 'active' : ''}`}
          onClick={() => switchTimerMode('work')}
        >
          Focus (25m)
        </button>
        <button
          className={`pomodoro-mode-btn ${timerMode === 'shortBreak' ? 'active' : ''}`}
          onClick={() => switchTimerMode('shortBreak')}
        >
          Short Break (5m)
        </button>
        <button
          className={`pomodoro-mode-btn ${timerMode === 'longBreak' ? 'active' : ''}`}
          onClick={() => switchTimerMode('longBreak')}
        >
          Long Break (15m)
        </button>
      </div>
      <div className="pomodoro-display">
        <div className="pomodoro-time">{formatTime(timeLeft)}</div>
      </div>
      <div className="pomodoro-controls">
        <button className="pomodoro-btn-main" onClick={toggleTimer}>
          {isTimerRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
          onClick={resetTimer}
        >
          🔄 Reset
        </button>
      </div>
      <div className="pomodoro-stats">
        <span>
          Sessions Completed: <strong style={{ color: '#818cf8' }}>{completedSessions}</strong> 🏆
        </span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {timerMode === 'work' ? 'Stay Focused' : 'Take a Break'}
        </span>
      </div>
    </div>
  );
}
