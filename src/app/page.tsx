"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pace = "calm" | "steady" | "deep";
type ThemeMode = "light" | "dark";
type ViewMode = "today" | "plans" | "stats" | "settings";

type Stretch = {
  name: string;
  area: string;
  duration: number;
  note: string;
  cue: string;
  focus: string;
};

type WeeklyTask = {
  id: string;
  label: string;
  done: boolean;
};

type DailyPlan = {
  day: string;
  focus: string;
  active: boolean;
  tasks: WeeklyTask[];
};

type ProgressState = {
  completedSessions: number;
  totalMinutes: number;
  lastCompletedDate: string | null;
  currentStreak: number;
  bestStreak: number;
  completedDates: string[];
  stretchStats: Record<string, StretchTiming>;
};

type StretchTiming = {
  sessions: number;
  totalSeconds: number;
  lastSeconds: number | null;
  lastCompletedDate: string | null;
  todaySeconds: number | null;
  todayDate: string | null;
};

type SettingsState = {
  dailyGoalMinutes: number;
  reminderTime: string;
  soundEnabled: boolean;
  defaultPace: Pace;
};

const defaultRoutine: Stretch[] = [
  {
    name: "Neck release",
    area: "Upper body",
    duration: 45,
    note: "Drop one ear toward your shoulder and breathe into the side of the neck.",
    cue: "Keep the jaw loose",
    focus: "Tension"
  },
  {
    name: "Chest opener",
    area: "Posture",
    duration: 60,
    note: "Interlace fingers behind your back, lift the chest, and keep the ribs soft.",
    cue: "Breathe into the ribs",
    focus: "Breath"
  },
  {
    name: "Hip flexor lunge",
    area: "Hips",
    duration: 75,
    note: "Tuck the pelvis gently and shift forward until the front of the hip opens.",
    cue: "Glute on, ribs down",
    focus: "Mobility"
  },
  {
    name: "Hamstring fold",
    area: "Legs",
    duration: 60,
    note: "Hinge from the hips with a long spine and keep a small bend in the knee.",
    cue: "Reach through the heel",
    focus: "Length"
  },
  {
    name: "Figure-four stretch",
    area: "Glutes",
    duration: 60,
    note: "Cross the ankle over the opposite knee and sit back to open the outer hip.",
    cue: "Keep the chest lifted",
    focus: "Release"
  },
  {
    name: "Calf pump",
    area: "Lower legs",
    duration: 40,
    note: "Press the heel down and gently bend the knee to wake up the calf and ankle.",
    cue: "Drive the heel into the floor",
    focus: "Stability"
  }
];

const defaultPlanner: DailyPlan[] = [
  { day: "Mon", focus: "Mobility reset", active: true, tasks: [
    { id: "mon-1", label: "10 minute mobility flow", done: false },
    { id: "mon-2", label: "Neck + chest opener", done: false },
    { id: "mon-3", label: "Walk after session", done: false }
  ] },
  { day: "Tue", focus: "Lower body", active: true, tasks: [
    { id: "tue-1", label: "Hip flexor work", done: false },
    { id: "tue-2", label: "Hamstring stretch", done: false },
    { id: "tue-3", label: "Calves + ankles", done: false }
  ] },
  { day: "Wed", focus: "Recovery", active: true, tasks: [
    { id: "wed-1", label: "Gentle breathing warm-up", done: false },
    { id: "wed-2", label: "Figure-four stretch", done: false },
    { id: "wed-3", label: "Light mobility cooldown", done: false }
  ] },
  { day: "Thu", focus: "Strength + flexibility", active: true, tasks: [
    { id: "thu-1", label: "Upper body opener", done: false },
    { id: "thu-2", label: "Deep lunge sequence", done: false },
    { id: "thu-3", label: "Stretch hold check-in", done: false }
  ] },
  { day: "Fri", focus: "Reset + posture", active: true, tasks: [
    { id: "fri-1", label: "Posture reset", done: false },
    { id: "fri-2", label: "Hip release", done: false },
    { id: "fri-3", label: "Journal energy level", done: false }
  ] },
  { day: "Sat", focus: "Longer flow", active: false, tasks: [
    { id: "sat-1", label: "Full mobility routine", done: false },
    { id: "sat-2", label: "Deep breathing", done: false },
    { id: "sat-3", label: "Optional walk", done: false }
  ] },
  { day: "Sun", focus: "Recovery day", active: false, tasks: [
    { id: "sun-1", label: "Light stretching only", done: false },
    { id: "sun-2", label: "Foam rolling", done: false },
    { id: "sun-3", label: "Sleep prep", done: false }
  ] }
];

const paceMultiplier: Record<Pace, number> = {
  calm: 0.85,
  steady: 1,
  deep: 1.2
};

const routineStorageKey = "stretch-routine-v1";
const progressStorageKey = "stretch-progress-v1";
const plannerStorageKey = "stretch-planner-v1";
const themeStorageKey = "stretch-theme-v1";
const settingsStorageKey = "stretch-settings-v1";

const defaultProgress: ProgressState = {
  completedSessions: 0,
  totalMinutes: 0,
  lastCompletedDate: null,
  currentStreak: 0,
  bestStreak: 0,
  completedDates: [],
  stretchStats: {}
};

const defaultSettings: SettingsState = {
  dailyGoalMinutes: 8,
  reminderTime: "18:30",
  soundEnabled: true,
  defaultPace: "steady"
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getPreviousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getRecentDateKeys(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  }).reverse();
}

function normalizeProgress(progress: Partial<ProgressState>): ProgressState {
  return {
    ...defaultProgress,
    ...progress,
    completedDates: Array.isArray(progress.completedDates) ? progress.completedDates : [],
    stretchStats: progress.stretchStats && typeof progress.stretchStats === "object"
      ? progress.stretchStats
      : {}
  };
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getStretchKey(stretch: Stretch) {
  return `${stretch.name}-${stretch.area}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function emptyStretchTiming(): StretchTiming {
  return {
    sessions: 0,
    totalSeconds: 0,
    lastSeconds: null,
    lastCompletedDate: null,
    todaySeconds: null,
    todayDate: null
  };
}

function loadSavedRoutine(): Stretch[] {
  if (typeof window === "undefined") return defaultRoutine;

  const saved = window.localStorage.getItem(routineStorageKey);
  if (!saved) return defaultRoutine;

  try {
    const parsed = JSON.parse(saved) as Stretch[];
    return parsed.length > 0 ? parsed : defaultRoutine;
  } catch {
    return defaultRoutine;
  }
}

function loadSavedProgress(): ProgressState {
  if (typeof window === "undefined") return defaultProgress;

  const saved = window.localStorage.getItem(progressStorageKey);
  if (!saved) return defaultProgress;

  try {
    return normalizeProgress(JSON.parse(saved) as Partial<ProgressState>);
  } catch {
    return defaultProgress;
  }
}

function loadSavedPlanner(): DailyPlan[] {
  if (typeof window === "undefined") return defaultPlanner;

  const saved = window.localStorage.getItem(plannerStorageKey);
  if (!saved) return defaultPlanner;

  try {
    const parsed = JSON.parse(saved) as DailyPlan[];
    return parsed.length === 7 ? parsed : defaultPlanner;
  } catch {
    return defaultPlanner;
  }
}

function loadSavedSettings(): SettingsState {
  if (typeof window === "undefined") return defaultSettings;

  const saved = window.localStorage.getItem(settingsStorageKey);
  if (!saved) return defaultSettings;

  try {
    return { ...defaultSettings, ...(JSON.parse(saved) as Partial<SettingsState>) };
  } catch {
    return defaultSettings;
  }
}

function playAlert(soundEnabled: boolean) {
  if (typeof window === "undefined" || !soundEnabled) return;

  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.06;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    void context.close();
  } catch {
    // Silence unsupported browsers
  }
}

export default function Home() {
  const [view, setView] = useState<ViewMode>("today");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [routine, setRoutine] = useState<Stretch[]>(defaultRoutine);
  const [planner, setPlanner] = useState<DailyPlan[]>(defaultPlanner);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pace, setPace] = useState<Pace>("steady");
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(defaultRoutine[0].duration);
  const [completed, setCompleted] = useState<number[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [progress, setProgress] = useState<ProgressState>(defaultProgress);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [customStretch, setCustomStretch] = useState({
    name: "",
    area: "",
    duration: "30",
    note: "",
    cue: "",
    focus: "Mobility"
  });
  const recordStretchCompletion = useCallback((stretch: Stretch, elapsedSeconds: number) => {
    const stretchKey = getStretchKey(stretch);
    const today = getTodayKey();
    const roundedSeconds = Math.max(0, Math.round(elapsedSeconds));

    setProgress((current) => {
      const currentTiming = current.stretchStats[stretchKey] ?? emptyStretchTiming();
      const nextSessions = currentTiming.sessions + 1;

      return {
        ...current,
        stretchStats: {
          ...current.stretchStats,
          [stretchKey]: {
            sessions: nextSessions,
            totalSeconds: currentTiming.totalSeconds + roundedSeconds,
            lastSeconds: roundedSeconds,
            lastCompletedDate: today,
            todaySeconds: roundedSeconds,
            todayDate: today
          }
        }
      };
    });
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const savedSettings = loadSavedSettings();
      const savedRoutine = loadSavedRoutine();
      const storedTheme = window.localStorage.getItem(themeStorageKey);

      setSettings(savedSettings);
      setPace(savedSettings.defaultPace);
      setRoutine(savedRoutine);
      setPlanner(loadSavedPlanner());
      setProgress(loadSavedProgress());
      setSecondsLeft(Math.round(savedRoutine[0].duration * paceMultiplier[savedSettings.defaultPace]));

      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }

      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [hasHydrated, theme]);

  useEffect(() => {
    if (!hasHydrated || routine.length === 0) return;
    window.localStorage.setItem(routineStorageKey, JSON.stringify(routine));
  }, [hasHydrated, routine]);

  useEffect(() => {
    if (!hasHydrated || planner.length === 0) return;
    window.localStorage.setItem(plannerStorageKey, JSON.stringify(planner));
  }, [hasHydrated, planner]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  }, [hasHydrated, progress]);

  useEffect(() => {
    if (!hasHydrated) return;
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [hasHydrated, settings]);

  useEffect(() => {
    if (!routine.length) return;
    window.requestAnimationFrame(() => {
      setSecondsLeft(Math.round(routine[activeIndex].duration * paceMultiplier[pace]));
      setIsRunning(false);
    });
  }, [activeIndex, pace, routine]);

  useEffect(() => {
    if (!routine.length || !isRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          playAlert(settings.soundEnabled);
          recordStretchCompletion(
            routine[activeIndex],
            routine[activeIndex].duration * paceMultiplier[pace]
          );
          setCompleted((existing) =>
            existing.includes(activeIndex) ? existing : [...existing, activeIndex]
          );

          if (activeIndex === routine.length - 1) {
            setIsRunning(false);
            return 0;
          }

          setActiveIndex((nextIndex) => nextIndex + 1);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeIndex, isRunning, pace, recordStretchCompletion, routine, settings.soundEnabled]);

  const activeStretch = routine[activeIndex] ?? routine[0];
  const adjustedDuration = activeStretch ? Math.round(activeStretch.duration * paceMultiplier[pace]) : 0;
  const activeStretchTiming = activeStretch
    ? progress.stretchStats[getStretchKey(activeStretch)] ?? emptyStretchTiming()
    : emptyStretchTiming();
  const activeStretchTime = activeStretchTiming.todayDate === getTodayKey()
    ? activeStretchTiming.todaySeconds
    : null;
  const activeStretchAverage = activeStretchTiming.sessions > 0
    ? Math.round(activeStretchTiming.totalSeconds / activeStretchTiming.sessions)
    : null;
  const routineLength = useMemo(
    () => routine.reduce((total, stretch) => total + stretch.duration, 0),
    [routine]
  );
  const progressPercent = routine.length ? ((activeIndex + 1) / routine.length) * 100 : 0;
  const sessionComplete = routine.length > 0 && completed.length >= routine.length;
  const totalWeeklyTasks = planner.reduce((sum, day) => sum + day.tasks.length, 0);
  const completedWeeklyTasks = planner.reduce(
    (sum, day) => sum + day.tasks.filter((task) => task.done).length,
    0
  );
  const weeklyProgressPct = totalWeeklyTasks ? (completedWeeklyTasks / totalWeeklyTasks) * 100 : 0;
  const selectedDay = planner[selectedDayIndex] ?? planner[0];
  const todayMinutes = progress.lastCompletedDate === getTodayKey() ? Math.round(routineLength / 60) : 0;
  const dailyGoalProgress = settings.dailyGoalMinutes
    ? Math.min((todayMinutes / settings.dailyGoalMinutes) * 100, 100)
    : 0;
  const recentDates = getRecentDateKeys(7);

  useEffect(() => {
    if (!sessionComplete) return;

    const today = getTodayKey();
    const totalRoutineMinutes = Math.round(routineLength / 60);

    window.requestAnimationFrame(() => {
      setProgress((current) => {
        const completedDates = current.completedDates.includes(today)
          ? current.completedDates
          : [...current.completedDates, today];
        const continuedStreak = current.lastCompletedDate === getPreviousDateKey(today);
        const alreadyCompletedToday = current.lastCompletedDate === today;
        const nextStreak = alreadyCompletedToday
          ? current.currentStreak
          : continuedStreak
            ? current.currentStreak + 1
            : 1;

        return {
          ...current,
          completedSessions: current.completedSessions + 1,
          totalMinutes: current.totalMinutes + totalRoutineMinutes,
          lastCompletedDate: today,
          currentStreak: nextStreak,
          bestStreak: Math.max(current.bestStreak, nextStreak),
          completedDates
        };
      });
      setCompleted([]);
    });
  }, [sessionComplete, routineLength]);

  const handleStretchChange = (nextIndex: number) => {
    if (!routine.length) return;
    setActiveIndex(nextIndex);
    setIsRunning(false);
    setSecondsLeft(Math.round(routine[nextIndex].duration * paceMultiplier[pace]));
  };

  const handlePrevious = () => {
    if (!routine.length) return;
    const previousIndex = activeIndex === 0 ? routine.length - 1 : activeIndex - 1;
    handleStretchChange(previousIndex);
  };

  const handleNext = () => {
    if (!routine.length) return;
    if (activeIndex === routine.length - 1) {
      setActiveIndex(0);
      setSecondsLeft(Math.round(routine[0].duration * paceMultiplier[pace]));
      setIsRunning(false);
      return;
    }

    handleStretchChange(activeIndex + 1);
  };

  const handleCompleteCurrent = () => {
    if (!routine.length) return;

    if (!completed.includes(activeIndex)) {
      recordStretchCompletion(activeStretch, adjustedDuration - secondsLeft);
    }

    setCompleted((existing) =>
      existing.includes(activeIndex) ? existing : [...existing, activeIndex]
    );
    setIsRunning(false);

    if (activeIndex < routine.length - 1) {
      handleStretchChange(activeIndex + 1);
      return;
    }

    setSecondsLeft(0);
  };

  const handleStopTimer = () => {
    if (!routine.length) return;
    setIsRunning(false);
    setSecondsLeft(Math.round(routine[activeIndex].duration * paceMultiplier[pace]));
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) return;

    const swipeDistance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(swipeDistance) < 50) return;

    if (swipeDistance > 0) {
      handlePrevious();
      return;
    }

    handleNext();
  };

  const handleReset = () => {
    setActiveIndex(0);
    setCompleted([]);
    setIsRunning(false);
    if (routine.length) {
      setSecondsLeft(Math.round(routine[0].duration * paceMultiplier[pace]));
    }
  };

  const addCustomStretch = () => {
    const name = customStretch.name.trim();
    const area = customStretch.area.trim() || "Custom";
    const duration = Number(customStretch.duration) || 30;

    if (!name) return;

    const newStretch: Stretch = {
      name,
      area,
      duration,
      note: customStretch.note.trim() || "Move slowly and focus on your breathing.",
      cue: customStretch.cue.trim() || "Keep the movement smooth",
      focus: customStretch.focus || "Mobility"
    };

    setRoutine((current) => [...current, newStretch]);
    setCustomStretch({
      name: "",
      area: "",
      duration: "30",
      note: "",
      cue: "",
      focus: "Mobility"
    });
    setShowEditor(false);
  };

  const removeStretch = (indexToRemove: number) => {
    if (routine.length <= 1) return;

    setRoutine((current) => current.filter((_, index) => index !== indexToRemove));
    setCompleted((current) => current.filter((index) => index !== indexToRemove));

    if (activeIndex >= routine.length - 1) {
      setActiveIndex(Math.max(0, routine.length - 2));
    }
  };

  const resetToDefault = () => {
    setRoutine(defaultRoutine);
    setActiveIndex(0);
    setCompleted([]);
    setIsRunning(false);
    setSecondsLeft(Math.round(defaultRoutine[0].duration * paceMultiplier[pace]));
    setShowEditor(false);
  };

  const toggleTask = (dayIndex: number, taskIndex: number) => {
    setPlanner((current) =>
      current.map((day, index) =>
        index !== dayIndex
          ? day
          : {
              ...day,
              tasks: day.tasks.map((task, idx) =>
                idx === taskIndex ? { ...task, done: !task.done } : task
              )
            }
      )
    );
  };

  const appBackground = theme === "dark" ? "bg-[#0b1020] text-white" : "bg-[#f5f5f7] text-[#111113]";
  const mutedText = theme === "dark" ? "text-[#b9c2d5]" : "text-[#6e6e73]";
  const panelClass = theme === "dark" ? "bg-[#111827] border border-white/10" : "bg-white";
  const softPanelClass = theme === "dark" ? "bg-[#182235] border border-white/10" : "bg-[#f2f2f7]";
  const navClass = theme === "dark" ? "bg-[#111827]/90 border-white/10" : "bg-white/85 border-black/10";

  if (!routine.length || !planner.length) {
    return null;
  }

  return (
    <main className={`min-h-screen ${appBackground}`}>
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:max-w-lg">
        <header className={`sticky top-0 z-10 -mx-4 px-4 pb-3 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur-xl ${theme === "dark" ? "bg-[#0b1020]/85" : "bg-[#f5f5f7]/85"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                aria-label="Previous stretch"
                className={`grid h-10 w-10 place-items-center rounded-full ${theme === "dark" ? "bg-[#182235] text-white" : "bg-white text-[#111113]"} text-2xl font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)]`}
                onClick={handlePrevious}
                type="button"
              >
                ‹
              </button>
              <div className="text-left">
                <p className={`text-[12px] font-semibold ${mutedText}`}>Daily Mobility</p>
                <h1 className="text-[17px] font-semibold">Stretches</h1>
              </div>
              <button
                aria-label="Next stretch"
                className={`grid h-10 w-10 place-items-center rounded-full ${theme === "dark" ? "bg-[#182235] text-white" : "bg-white text-[#111113]"} text-2xl font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)]`}
                onClick={handleNext}
                type="button"
              >
                ›
              </button>
            </div>

            <button
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              className={`grid h-10 w-10 place-items-center rounded-full text-lg shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-white text-[#111113]"}`}
              onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              type="button"
            >
              {theme === "light" ? "☾" : "☀"}
            </button>
          </div>

          {view === "today" ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
              <div
                className="h-full rounded-full bg-[#34c759] transition-all duration-300"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          ) : null}
        </header>

        {view === "today" ? (
          <>
            <div className={`mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl p-1 ${theme === "dark" ? "bg-[#182235]" : "bg-[#e5e5ea]"}`}>
              <div className={`flex h-9 items-center justify-between rounded-lg px-3 ${theme === "dark" ? "bg-[#111827] text-white" : "bg-white text-[#111113]"} shadow-sm`}>
                <span className={`text-[12px] font-bold uppercase ${mutedText}`}>Timer</span>
                <span className="text-[17px] font-bold tabular-nums">{formatTime(secondsLeft)}</span>
              </div>
              <button
                className={`h-9 rounded-lg px-3 text-[13px] font-semibold ${theme === "dark" ? "bg-[#dfe8ff] text-[#111827]" : "bg-[#111113] text-white"}`}
                onClick={() => setIsRunning(true)}
                type="button"
              >
                Start
              </button>
              <button
                className={`h-9 rounded-lg px-3 text-[13px] font-semibold ${theme === "dark" ? "bg-[#111827] text-[#dfe8ff]" : "bg-white text-[#0b57d0]"}`}
                onClick={handleStopTimer}
                type="button"
              >
                Stop
              </button>
            </div>

            <section
              className={`mt-4 rounded-[28px] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)] ${panelClass}`}
              onTouchEnd={handleTouchEnd}
              onTouchStart={handleTouchStart}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-[#007aff]">{activeStretch.area}</p>
                  <h2 className="mt-2 text-4xl font-bold leading-tight tracking-normal">
                    {activeStretch.name}
                  </h2>
                </div>
                <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${softPanelClass} text-center`}>
                  <span className="text-2xl font-bold">{Math.max(1, adjustedDuration)}</span>
                  <span className={`-mt-3 text-[11px] font-semibold ${mutedText}`}>sec</span>
                </div>
              </div>

              <div className="mt-6 rounded-[24px] bg-[radial-gradient(circle_at_35%_28%,#ffffff_0,#ffffff_12%,transparent_13%),linear-gradient(145deg,#d7f7df,#b5d8ff_55%,#f8d0d9)] p-4">
                <div className="flex h-full min-h-[170px] flex-col justify-between rounded-[20px] bg-white/35 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-full bg-white/70 shadow-inner" />
                    <div className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#111113]">
                      {activeStretch.focus}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6e6e73]">
                      Timer
                    </div>
                    <div className="text-5xl font-bold tabular-nums text-[#111113]">{formatTime(secondsLeft)}</div>
                  </div>
                </div>
              </div>

              <p className={`mt-5 text-[17px] leading-7 ${theme === "dark" ? "text-[#dfe8ff]" : "text-[#3a3a3c]"}`}>
                {activeStretch.note}
              </p>

              <div className={`mt-5 rounded-2xl ${softPanelClass} p-4`}>
                <span className={`text-[12px] font-semibold uppercase ${mutedText}`}>Cue</span>
                <p className="mt-1 text-[17px] font-semibold">{activeStretch.cue}</p>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto] gap-3">
                <button
                  className={`h-14 rounded-2xl text-[17px] font-semibold ${theme === "dark" ? "bg-[#dfe8ff] text-[#111827]" : "bg-[#111113] text-white"} shadow-[0_10px_20px_rgba(17,17,19,0.16)]`}
                  onClick={handleCompleteCurrent}
                  type="button"
                >
                  Completed
                </button>
                <button
                  className={`h-14 rounded-2xl px-5 text-[17px] font-semibold ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#eef3ff] text-[#0b57d0]"}`}
                  onClick={handleNext}
                  type="button"
                >
                  Skip
                </button>
              </div>
            </section>

            <section className={`mt-5 rounded-[24px] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)] ${panelClass}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-bold">Saved progress</h2>
                <button
                  className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#0b57d0]"
                  onClick={() => setShowEditor((current) => !current)}
                  type="button"
                >
                  {showEditor ? "Close" : "Customize"}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Sessions</div>
                  <div className="mt-1 text-[24px] font-bold">{activeStretchTiming.sessions}</div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Time</div>
                  <div className="mt-1 text-[14px] font-bold tabular-nums">
                    {activeStretchTime === null ? "N/A" : formatTime(activeStretchTime)}
                  </div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Last</div>
                  <div className="mt-1 text-[14px] font-bold tabular-nums">
                    {activeStretchTiming.lastSeconds === null ? "N/A" : formatTime(activeStretchTiming.lastSeconds)}
                  </div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Avg.</div>
                  <div className="mt-1 text-[14px] font-bold tabular-nums">
                    {activeStretchAverage === null ? "N/A" : formatTime(activeStretchAverage)}
                  </div>
                </div>
              </div>

              {showEditor ? (
                <div className={`mt-4 space-y-3 rounded-2xl border p-3 ${theme === "dark" ? "border-white/10 bg-[#0f172a]" : "border-[#e5e5ea] bg-[#fafafa]"}`}>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                      onChange={(event) =>
                        setCustomStretch((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Stretch name"
                      value={customStretch.name}
                    />
                    <input
                      className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                      onChange={(event) =>
                        setCustomStretch((current) => ({ ...current, area: event.target.value }))
                      }
                      placeholder="Area"
                      value={customStretch.area}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                      onChange={(event) =>
                        setCustomStretch((current) => ({ ...current, duration: event.target.value }))
                      }
                      placeholder="Seconds"
                      type="number"
                      value={customStretch.duration}
                    />
                    <input
                      className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                      onChange={(event) =>
                        setCustomStretch((current) => ({ ...current, focus: event.target.value }))
                      }
                      placeholder="Focus"
                      value={customStretch.focus}
                    />
                  </div>

                  <input
                    className={`h-11 w-full rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                    onChange={(event) =>
                      setCustomStretch((current) => ({ ...current, cue: event.target.value }))
                    }
                    placeholder="Cue"
                    value={customStretch.cue}
                  />

                  <textarea
                    className={`min-h-[80px] w-full rounded-xl border px-3 py-2 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                    onChange={(event) =>
                      setCustomStretch((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Instructions"
                    value={customStretch.note}
                  />

                  <div className="flex gap-2">
                    <button
                      className={`h-11 flex-1 rounded-xl text-[14px] font-semibold ${theme === "dark" ? "bg-[#dfe8ff] text-[#111827]" : "bg-[#111113] text-white"}`}
                      onClick={addCustomStretch}
                      type="button"
                    >
                      Add stretch
                    </button>
                    <button
                      className={`h-11 flex-1 rounded-xl text-[14px] font-semibold ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#eef3ff] text-[#0b57d0]"}`}
                      onClick={resetToDefault}
                      type="button"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className={`mt-5 ${panelClass}`}>
              <div className="flex items-center justify-between px-1 py-3">
                <h2 className="text-[22px] font-bold">Routine</h2>
                <span className={`text-[15px] font-semibold ${mutedText}`}>
                  {Math.round(routineLength / 60)} min
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-transparent">
                {routine.map((stretch, index) => {
                  const done = completed.includes(index);

                  return (
                    <div className={`flex w-full items-center gap-3 border-b px-4 py-3 last:border-b-0 ${theme === "dark" ? "border-white/10" : "border-[#f2f2f7]"}`} key={`${stretch.name}-${index}`}>
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => handleStretchChange(index)}
                        type="button"
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                            index === activeIndex
                              ? "bg-[#007aff] text-white"
                              : done
                                ? "bg-[#dff6e8] text-[#1f8f57]"
                                : theme === "dark"
                                  ? "bg-[#182235] text-[#dfe8ff]"
                                  : "bg-[#f2f2f7] text-[#6e6e73]"
                          }`}
                        >
                          {done ? "✓" : index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[17px]">{stretch.name}</strong>
                          <span className={`mt-0.5 block text-[14px] ${mutedText}`}>{stretch.area}</span>
                        </span>
                        <span className={`text-[15px] font-semibold ${theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}>
                          {Math.round(stretch.duration * paceMultiplier[pace])}s
                        </span>
                      </button>

                      <button
                        aria-label={`Remove ${stretch.name}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#f2f2f7] text-[#6e6e73]"} text-lg`}
                        onClick={() => removeStretch(index)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {sessionComplete ? (
              <div className="mt-5 rounded-[24px] bg-[#eafaf2] p-4 text-[#166c42] shadow-sm">
                <div className="text-[12px] font-bold uppercase tracking-[0.18em]">Session complete</div>
                <div className="mt-2 text-[22px] font-bold">Nice work — you finished your routine.</div>
                <button
                  className="mt-4 h-12 rounded-xl bg-[#166c42] px-4 text-[15px] font-semibold text-white"
                  onClick={handleReset}
                  type="button"
                >
                  Reset routine
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {view === "plans" ? (
          <section className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[12px] font-semibold uppercase ${mutedText}`}>7-day plan</p>
                <h2 className="text-[28px] font-bold">Weekly planner</h2>
              </div>
              <button
                className="rounded-full bg-[#007aff] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white"
                onClick={() => {
                  setPlanner(defaultPlanner);
                  setSelectedDayIndex(0);
                }}
                type="button"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {planner.map((day, index) => {
                const completedCount = day.tasks.filter((task) => task.done).length;
                const progressPercentForDay = (completedCount / day.tasks.length) * 100;
                const isSelected = selectedDayIndex === index;

                return (
                  <button
                    className={`rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? theme === "dark"
                          ? "border-[#007aff] bg-[#182235] shadow-[0_0_0_1px_rgba(0,122,255,0.3)]"
                          : "border-[#007aff] bg-[#eef3ff]"
                        : theme === "dark"
                          ? "border-white/10 bg-[#111827]"
                          : "border-[#e5e5ea] bg-white"
                    }`}
                    key={day.day}
                    onClick={() => setSelectedDayIndex(index)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Day</div>
                        <div className="mt-1 text-[18px] font-bold">{day.day}</div>
                      </div>
                      <span className="rounded-full bg-[#007aff]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#0b57d0]">
                        {completedCount}/{day.tasks.length}
                      </span>
                    </div>

                    <div className={`mt-3 text-[12px] font-semibold ${mutedText}`}>{day.focus}</div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5e5ea]">
                      <div
                        className="h-full rounded-full bg-[#34c759]"
                        style={{ width: `${Math.min(progressPercentForDay, 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Selected day</div>
                  <h3 className="text-[22px] font-bold">{selectedDay.day}</h3>
                </div>
                <div className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#eef3ff] text-[#0b57d0]"}`}>
                  {selectedDay.focus}
                </div>
              </div>

              <div className="space-y-3">
                {selectedDay.tasks.map((task, taskIndex) => (
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 ${theme === "dark" ? "bg-[#182235]" : "bg-[#f2f2f7]"}`}
                    key={task.id}
                  >
                    <input
                      checked={task.done}
                      className="h-5 w-5 accent-[#007aff]"
                      onChange={() => toggleTask(selectedDayIndex, taskIndex)}
                      type="checkbox"
                    />
                    <span className={task.done ? "line-through opacity-60" : ""}>{task.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {view === "stats" ? (
          <section className="mt-5 space-y-4">
            <div>
              <p className={`text-[12px] font-semibold uppercase ${mutedText}`}>Progress snapshot</p>
              <h2 className="text-[30px] font-bold">Workout summary</h2>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>This week</div>
                  <div className="text-[26px] font-bold">{Math.round(weeklyProgressPct)}%</div>
                </div>
                <div className="text-[12px] font-semibold text-[#0b57d0]">
                  {completedWeeklyTasks}/{totalWeeklyTasks} tasks
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
                <div
                  className="h-full rounded-full bg-[#34c759]"
                  style={{ width: `${Math.min(weeklyProgressPct, 100)}%` }}
                />
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Current streak</div>
                  <div className="text-[30px] font-bold">{progress.currentStreak} days</div>
                </div>
                <div className="rounded-full bg-[#34c759]/15 px-3 py-1 text-[12px] font-bold text-[#166c42]">
                  Best {progress.bestStreak}
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {recentDates.map((dateKey) => {
                  const isDone = progress.completedDates.includes(dateKey);
                  const day = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en", {
                    weekday: "short"
                  }).slice(0, 1);

                  return (
                    <div className="text-center" key={dateKey}>
                      <div className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold ${
                        isDone
                          ? "bg-[#34c759] text-white"
                          : theme === "dark"
                            ? "bg-[#182235] text-[#c5d2ec]"
                            : "bg-[#f2f2f7] text-[#8e8e93]"
                      }`}>
                        {isDone ? "✓" : day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Daily goal</div>
                  <div className="text-[26px] font-bold">{settings.dailyGoalMinutes} min</div>
                </div>
                <div className="text-[12px] font-semibold text-[#0b57d0]">
                  {Math.round(dailyGoalProgress)}%
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
                <div
                  className="h-full rounded-full bg-[#007aff]"
                  style={{ width: `${dailyGoalProgress}%` }}
                />
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[20px] font-bold">Weekly totals</h3>
                <span className={`text-[12px] font-semibold ${mutedText}`}>Saved</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] uppercase ${mutedText}`}>Sessions</div>
                  <div className="mt-2 text-[24px] font-bold">{progress.completedSessions}</div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] uppercase ${mutedText}`}>Minutes</div>
                  <div className="mt-2 text-[24px] font-bold">{progress.totalMinutes}</div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] uppercase ${mutedText}`}>Last</div>
                  <div className="mt-2 text-[12px] font-bold">
                    {progress.lastCompletedDate ? progress.lastCompletedDate.slice(5) : "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <h3 className="text-[20px] font-bold">Checklist status</h3>
              <div className="mt-3 space-y-2">
                {planner.map((day) => {
                  const dayDone = day.tasks.filter((task) => task.done).length;
                  return (
                    <div
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 ${theme === "dark" ? "bg-[#182235]" : "bg-[#f2f2f7]"}`}
                      key={day.day}
                    >
                      <span className="font-semibold">{day.day}</span>
                      <span className={`text-[12px] font-bold ${mutedText}`}>
                        {dayDone}/{day.tasks.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        {view === "settings" ? (
          <section className="mt-5 space-y-4">
            <div>
              <p className={`text-[12px] font-semibold uppercase ${mutedText}`}>Preferences</p>
              <h2 className="text-[30px] font-bold">Settings</h2>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Daily goal</div>
                  <div className="mt-1 text-[24px] font-bold">{settings.dailyGoalMinutes} min</div>
                </div>
                <input
                  aria-label="Daily goal minutes"
                  className={`h-11 w-24 rounded-xl border px-3 text-right text-[16px] font-semibold outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                  min={1}
                  max={90}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      dailyGoalMinutes: Math.max(1, Number(event.target.value) || 1)
                    }))
                  }
                  type="number"
                  value={settings.dailyGoalMinutes}
                />
              </div>

              <input
                aria-label="Daily goal slider"
                className="mt-4 w-full accent-[#007aff]"
                max={30}
                min={1}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    dailyGoalMinutes: Number(event.target.value)
                  }))
                }
                type="range"
                value={Math.min(settings.dailyGoalMinutes, 30)}
              />
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Reminder</div>
                  <div className="mt-1 text-[22px] font-bold">{settings.reminderTime}</div>
                </div>
                <input
                  aria-label="Reminder time"
                  className={`h-11 rounded-xl border px-3 text-[16px] font-semibold outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, reminderTime: event.target.value }))
                  }
                  type="time"
                  value={settings.reminderTime}
                />
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[20px] font-bold">Default pace</h3>
                <span className={`text-[12px] font-semibold capitalize ${mutedText}`}>{settings.defaultPace}</span>
              </div>

              <div className="grid grid-cols-3 rounded-xl bg-[#e5e5ea] p-1">
                {(["calm", "steady", "deep"] as const).map((mode) => (
                  <button
                    className={`h-9 rounded-lg text-[13px] font-semibold capitalize transition ${
                      settings.defaultPace === mode
                        ? theme === "dark"
                          ? "bg-[#182235] text-white shadow-sm"
                          : "bg-white text-[#111113] shadow-sm"
                        : "text-[#6e6e73]"
                    }`}
                    key={mode}
                    onClick={() => {
                      setSettings((current) => ({ ...current, defaultPace: mode }));
                      setPace(mode);
                    }}
                    type="button"
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-[20px] font-bold">Timer sound</span>
                  <span className={`mt-1 block text-[14px] ${mutedText}`}>Play a soft tone after each hold.</span>
                </span>
                <input
                  checked={settings.soundEnabled}
                  className="h-6 w-6 accent-[#007aff]"
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, soundEnabled: event.target.checked }))
                  }
                  type="checkbox"
                />
              </label>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <h3 className="text-[20px] font-bold">Progress reset</h3>
              <p className={`mt-1 text-[14px] ${mutedText}`}>Clear sessions, minutes, streaks, and completed dates.</p>
              <button
                className={`mt-4 h-12 w-full rounded-xl text-[15px] font-semibold ${theme === "dark" ? "bg-[#dfe8ff] text-[#111827]" : "bg-[#111113] text-white"}`}
                onClick={() => setProgress(defaultProgress)}
                type="button"
              >
                Reset progress
              </button>
            </div>
          </section>
        ) : null}

        <nav className={`fixed inset-x-0 bottom-0 z-20 border-t px-6 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl ${navClass}`}>
          <div className="mx-auto grid max-w-md grid-cols-4">
            <button
              className={`ios-tab ${view === "today" ? "text-[#007aff]" : theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}
              onClick={() => setView("today")}
              type="button"
            >
              <span>●</span>
              <span>Today</span>
            </button>
            <button
              className={`ios-tab ${view === "plans" ? "text-[#007aff]" : theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}
              onClick={() => setView("plans")}
              type="button"
            >
              <span>○</span>
              <span>Plans</span>
            </button>
            <button
              className={`ios-tab ${view === "stats" ? "text-[#007aff]" : theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}
              onClick={() => setView("stats")}
              type="button"
            >
              <span>◌</span>
              <span>Stats</span>
            </button>
            <button
              className={`ios-tab ${view === "settings" ? "text-[#007aff]" : theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}
              onClick={() => setView("settings")}
              type="button"
            >
              <span>⚙</span>
              <span>Settings</span>
            </button>
          </div>
        </nav>
      </section>
    </main>
  );
}
