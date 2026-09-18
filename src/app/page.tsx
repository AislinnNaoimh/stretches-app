"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Pace = "calm" | "steady" | "deep";
type ThemeMode = "light" | "dark";
type ViewMode = "today" | "plans" | "stats" | "settings";

type Stretch = {
  id: string;
  name: string;
  area: string;
  duration: number;
  note: string;
  cue: string;
  focus: string;
  reps?: string;
  imageUrl?: string;
};

type ProgressState = {
  completedSessions: number;
  totalMinutes: number;
  lastCompletedDate: string | null;
  currentStreak: number;
  bestStreak: number;
  completedDates: string[];
  stretchStats: Record<string, StretchTiming>;
  dailyLogs: Record<string, DailyLog>;
};

type StretchTiming = {
  sessions: number;
  timedSessions: number;
  totalSeconds: number;
  lastSeconds: number | null;
  lastCompletedDate: string | null;
  todaySeconds: number | null;
  todayDate: string | null;
};

type DailyLog = {
  completed: number;
  skipped: number;
  totalSeconds: number;
  timedSessions: number;
  difficultyTotal: number;
  difficultyEntries: number;
};

type SettingsState = {
  dailyGoalMinutes: number;
  reminderTime: string;
  soundEnabled: boolean;
  defaultPace: Pace;
};

const defaultRoutine: Stretch[] = [
  {
    id: "neck-release",
    name: "Neck release",
    area: "Upper body",
    duration: 45,
    note: "Drop one ear toward your shoulder and breathe into the side of the neck.",
    cue: "Keep the jaw loose",
    focus: "Tension"
  },
  {
    id: "chest-opener",
    name: "Chest opener",
    area: "Posture",
    duration: 60,
    note: "Interlace fingers behind your back, lift the chest, and keep the ribs soft.",
    cue: "Breathe into the ribs",
    focus: "Breath"
  },
  {
    id: "hip-flexor-lunge",
    name: "Hip flexor lunge",
    area: "Hips",
    duration: 75,
    note: "Tuck the pelvis gently and shift forward until the front of the hip opens.",
    cue: "Glute on, ribs down",
    focus: "Mobility"
  },
  {
    id: "hamstring-fold",
    name: "Hamstring fold",
    area: "Legs",
    duration: 60,
    note: "Hinge from the hips with a long spine and keep a small bend in the knee.",
    cue: "Reach through the heel",
    focus: "Length"
  },
  {
    id: "figure-four-stretch",
    name: "Figure-four stretch",
    area: "Glutes",
    duration: 60,
    note: "Cross the ankle over the opposite knee and sit back to open the outer hip.",
    cue: "Keep the chest lifted",
    focus: "Release"
  },
  {
    id: "calf-pump",
    name: "Calf pump",
    area: "Lower legs",
    duration: 40,
    note: "Press the heel down and gently bend the knee to wake up the calf and ankle.",
    cue: "Drive the heel into the floor",
    focus: "Stability"
  }
];

const paceMultiplier: Record<Pace, number> = {
  calm: 0.85,
  steady: 1,
  deep: 1.2
};

const routineStorageKey = "stretch-routine-v1";
const stretchLibraryStorageKey = "stretch-library-v1";
const progressStorageKey = "stretch-progress-v1";
const themeStorageKey = "stretch-theme-v1";
const settingsStorageKey = "stretch-settings-v1";

const defaultProgress: ProgressState = {
  completedSessions: 0,
  totalMinutes: 0,
  lastCompletedDate: null,
  currentStreak: 0,
  bestStreak: 0,
  completedDates: [],
  stretchStats: {},
  dailyLogs: {}
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

function getWeekDateKeys() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function getMonthDateKeys(dateKey: string) {
  const current = new Date(`${dateKey}T00:00:00`);
  const firstDay = new Date(current.getFullYear(), current.getMonth(), 1);
  const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  const leadingBlanks = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const days = Array.from({ length: lastDay.getDate() }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth(), index + 1);
    return date.toISOString().slice(0, 10);
  });

  return [...Array.from({ length: leadingBlanks }, () => null), ...days];
}

function normalizeProgress(progress: Partial<ProgressState>): ProgressState {
  const stretchStats = progress.stretchStats && typeof progress.stretchStats === "object"
    ? Object.fromEntries(
        Object.entries(progress.stretchStats).map(([key, timing]) => [
          key,
          {
            ...emptyStretchTiming(),
            ...timing,
            timedSessions: timing.timedSessions ?? (timing.lastSeconds === null ? 0 : timing.sessions)
          }
        ])
      )
    : {};

  return {
    ...defaultProgress,
    ...progress,
    completedDates: Array.isArray(progress.completedDates) ? progress.completedDates : [],
    stretchStats,
    dailyLogs: progress.dailyLogs && typeof progress.dailyLogs === "object"
      ? progress.dailyLogs
      : {}
  };
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatShortDate() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function makeStretchId(name: string, area: string) {
  return `${name}-${area}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeStretch(stretch: Partial<Stretch>, index: number): Stretch {
  const name = stretch.name?.trim() || `Stretch ${index + 1}`;
  const area = stretch.area?.trim() || "Mobility";

  return {
    id: stretch.id || makeStretchId(name, area) || `stretch-${index + 1}`,
    name,
    area,
    duration: Number(stretch.duration) || 30,
    note: stretch.note || "Move slowly and focus on your breathing.",
    cue: stretch.cue || "Keep the movement smooth",
    focus: stretch.focus || "Mobility",
    reps: stretch.reps || "",
    imageUrl: stretch.imageUrl || ""
  };
}

function normalizeStretchList(stretches: Partial<Stretch>[]) {
  const seen = new Set<string>();

  return stretches.map((stretch, index) => {
    const normalized = normalizeStretch(stretch, index);
    const baseId = normalized.id;
    let nextId = baseId;
    let suffix = 2;

    while (seen.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    seen.add(nextId);
    return { ...normalized, id: nextId };
  });
}

function mergeStretchLibrary(library: Stretch[], routine: Stretch[]) {
  const existingIds = new Set(library.map((stretch) => stretch.id));
  const missing = routine.filter((stretch) => !existingIds.has(stretch.id));

  return [...library, ...missing];
}

function getStretchKey(stretch: Stretch) {
  return stretch.id;
}

function emptyStretchTiming(): StretchTiming {
  return {
    sessions: 0,
    timedSessions: 0,
    totalSeconds: 0,
    lastSeconds: null,
    lastCompletedDate: null,
    todaySeconds: null,
    todayDate: null
  };
}

function emptyDailyLog(): DailyLog {
  return {
    completed: 0,
    skipped: 0,
    totalSeconds: 0,
    timedSessions: 0,
    difficultyTotal: 0,
    difficultyEntries: 0
  };
}

function loadSavedRoutine(): Stretch[] {
  if (typeof window === "undefined") return normalizeStretchList(defaultRoutine);

  const saved = window.localStorage.getItem(routineStorageKey);
  if (!saved) return normalizeStretchList(defaultRoutine);

  try {
    const parsed = JSON.parse(saved) as Partial<Stretch>[];
    return parsed.length > 0 ? normalizeStretchList(parsed) : normalizeStretchList(defaultRoutine);
  } catch {
    return normalizeStretchList(defaultRoutine);
  }
}

function loadSavedStretchLibrary(savedRoutine: Stretch[]): Stretch[] {
  if (typeof window === "undefined") return normalizeStretchList(defaultRoutine);

  const saved = window.localStorage.getItem(stretchLibraryStorageKey);
  if (!saved) return mergeStretchLibrary(normalizeStretchList(defaultRoutine), savedRoutine);

  try {
    const parsed = JSON.parse(saved) as Partial<Stretch>[];
    const library = parsed.length > 0 ? normalizeStretchList(parsed) : normalizeStretchList(defaultRoutine);
    return mergeStretchLibrary(library, savedRoutine);
  } catch {
    return mergeStretchLibrary(normalizeStretchList(defaultRoutine), savedRoutine);
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

export default function Home() {
  const [view, setView] = useState<ViewMode>("today");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [stretchLibrary, setStretchLibrary] = useState<Stretch[]>(normalizeStretchList(defaultRoutine));
  const [routine, setRoutine] = useState<Stretch[]>(normalizeStretchList(defaultRoutine));
  const [activeIndex, setActiveIndex] = useState(0);
  const [pace, setPace] = useState<Pace>("steady");
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const [progress, setProgress] = useState<ProgressState>(defaultProgress);
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayKey());
  const [weeklyStatsOpen, setWeeklyStatsOpen] = useState(true);
  const [expandedStretchId, setExpandedStretchId] = useState<string | null>(null);
  const [customStretch, setCustomStretch] = useState({
    name: "",
    area: "",
    duration: "30",
    note: "",
    cue: "",
    focus: "Mobility",
    reps: "",
    imageUrl: ""
  });
  const recordStretchCompletion = useCallback((stretch: Stretch, elapsedSeconds: number) => {
    const stretchKey = getStretchKey(stretch);
    const today = getTodayKey();
    const roundedSeconds = Math.max(0, Math.round(elapsedSeconds));
    const hasRecordedTime = roundedSeconds > 0;

    setProgress((current) => {
      const currentTiming = current.stretchStats[stretchKey] ?? emptyStretchTiming();
      const currentLog = current.dailyLogs[today] ?? emptyDailyLog();
      const nextSessions = currentTiming.sessions + 1;
      const nextTimedSessions = hasRecordedTime
        ? currentTiming.timedSessions + 1
        : currentTiming.timedSessions;

      return {
        ...current,
        stretchStats: {
          ...current.stretchStats,
          [stretchKey]: {
            sessions: nextSessions,
            timedSessions: nextTimedSessions,
            totalSeconds: hasRecordedTime
              ? currentTiming.totalSeconds + roundedSeconds
              : currentTiming.totalSeconds,
            lastSeconds: hasRecordedTime ? roundedSeconds : currentTiming.lastSeconds,
            lastCompletedDate: hasRecordedTime ? today : currentTiming.lastCompletedDate,
            todaySeconds: hasRecordedTime ? roundedSeconds : currentTiming.todaySeconds,
            todayDate: hasRecordedTime ? today : currentTiming.todayDate
          }
        },
        dailyLogs: {
          ...current.dailyLogs,
          [today]: {
            ...currentLog,
            completed: currentLog.completed + 1,
            totalSeconds: hasRecordedTime
              ? currentLog.totalSeconds + roundedSeconds
              : currentLog.totalSeconds,
            timedSessions: hasRecordedTime
              ? currentLog.timedSessions + 1
              : currentLog.timedSessions,
            difficultyTotal: currentLog.difficultyTotal + 3,
            difficultyEntries: currentLog.difficultyEntries + 1
          }
        }
      };
    });
  }, []);

  const recordStretchSkip = useCallback(() => {
    const today = getTodayKey();

    setProgress((current) => {
      const currentLog = current.dailyLogs[today] ?? emptyDailyLog();

      return {
        ...current,
        dailyLogs: {
          ...current.dailyLogs,
          [today]: {
            ...currentLog,
            skipped: currentLog.skipped + 1,
            difficultyTotal: currentLog.difficultyTotal + 3,
            difficultyEntries: currentLog.difficultyEntries + 1
          }
        }
      };
    });
  }, []);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      const savedSettings = loadSavedSettings();
      const savedRoutine = loadSavedRoutine();
      const savedLibrary = loadSavedStretchLibrary(savedRoutine);
      const storedTheme = window.localStorage.getItem(themeStorageKey);

      setSettings(savedSettings);
      setPace(savedSettings.defaultPace);
      setStretchLibrary(savedLibrary);
      setRoutine(savedRoutine);
      setProgress(loadSavedProgress());
      setSecondsLeft(0);

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
    if (!hasHydrated || stretchLibrary.length === 0) return;
    window.localStorage.setItem(stretchLibraryStorageKey, JSON.stringify(stretchLibrary));
  }, [hasHydrated, stretchLibrary]);

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
      setSecondsLeft(0);
      setIsRunning(false);
    });
  }, [activeIndex, pace, routine]);

  useEffect(() => {
    if (!routine.length || !isRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, routine.length]);

  const activeStretch = routine[activeIndex] ?? routine[0];
  const adjustedDuration = activeStretch ? Math.round(activeStretch.duration * paceMultiplier[pace]) : 0;
  const activeStretchTiming = activeStretch
    ? progress.stretchStats[getStretchKey(activeStretch)] ?? emptyStretchTiming()
    : emptyStretchTiming();
  const activeStretchTime = activeStretchTiming.todayDate === getTodayKey()
    ? activeStretchTiming.todaySeconds
    : null;
  const activeStretchAverage = activeStretchTiming.timedSessions > 0
    ? Math.round(activeStretchTiming.totalSeconds / activeStretchTiming.timedSessions)
    : null;
  const routineLength = useMemo(
    () => routine.reduce((total, stretch) => total + stretch.duration, 0),
    [routine]
  );
  const progressPercent = routine.length ? ((activeIndex + 1) / routine.length) * 100 : 0;
  const sessionComplete = routine.length > 0 && routine.every((_, index) =>
    completed.includes(index) || skipped.includes(index)
  );
  const weeklyDateKeys = getWeekDateKeys();
  const weeklyStretchTarget = 45;
  const completedWeeklyStretches = weeklyDateKeys.reduce(
    (sum, dateKey) => sum + (progress.dailyLogs[dateKey]?.completed ?? 0),
    0
  );
  const weeklyProgressPct = (completedWeeklyStretches / weeklyStretchTarget) * 100;
  const monthDateKeys = getMonthDateKeys(selectedCalendarDate);
  const selectedDailyLog = progress.dailyLogs[selectedCalendarDate] ?? emptyDailyLog();
  const selectedCompletionTotal = selectedDailyLog.completed + selectedDailyLog.skipped;
  const selectedCompletionPct = selectedCompletionTotal
    ? Math.round((selectedDailyLog.completed / selectedCompletionTotal) * 100)
    : 0;
  const selectedDifficultyPct = selectedDailyLog.difficultyEntries
    ? Math.round((selectedDailyLog.difficultyTotal / (selectedDailyLog.difficultyEntries * 5)) * 100)
    : 0;
  const selectedAvgSeconds = selectedDailyLog.timedSessions
    ? Math.round(selectedDailyLog.totalSeconds / selectedDailyLog.timedSessions)
    : null;

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
    });
  }, [sessionComplete, routineLength]);

  const handleStretchChange = (nextIndex: number) => {
    if (!routine.length) return;
    setActiveIndex(nextIndex);
    setIsRunning(false);
    setSecondsLeft(0);
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
      setSecondsLeft(0);
      setIsRunning(false);
      return;
    }

    handleStretchChange(activeIndex + 1);
  };

  const handleCompleteCurrent = () => {
    if (!routine.length) return;

    if (!completed.includes(activeIndex)) {
      recordStretchCompletion(activeStretch, secondsLeft);
    }

    setCompleted((existing) =>
      existing.includes(activeIndex) ? existing : [...existing, activeIndex]
    );
    setSkipped((existing) => existing.filter((index) => index !== activeIndex));
    setIsRunning(false);

    if (activeIndex < routine.length - 1) {
      handleStretchChange(activeIndex + 1);
      return;
    }

    setSecondsLeft(0);
  };

  const handleSkipCurrent = () => {
    if (!routine.length) return;

    if (!completed.includes(activeIndex) && !skipped.includes(activeIndex)) {
      recordStretchSkip();
    }

    setSkipped((existing) =>
      existing.includes(activeIndex) ? existing : [...existing, activeIndex]
    );
    setIsRunning(false);
    handleNext();
  };

  const handleStopTimer = () => {
    if (!routine.length) return;
    setIsRunning(false);
    setSecondsLeft(0);
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
    setSkipped([]);
    setIsRunning(false);
    setSecondsLeft(0);
  };

  const addCustomStretch = () => {
    const name = customStretch.name.trim();
    const area = customStretch.area.trim() || "Custom";
    const duration = Number(customStretch.duration) || 30;

    if (!name) return;

    const newStretch = normalizeStretch({
      id: makeStretchId(name, area),
      name,
      area,
      duration,
      note: customStretch.note.trim() || "Move slowly and focus on your breathing.",
      cue: customStretch.cue.trim() || "Keep the movement smooth",
      focus: customStretch.focus || "Mobility",
      reps: customStretch.reps.trim(),
      imageUrl: customStretch.imageUrl.trim()
    }, stretchLibrary.length);

    setStretchLibrary((current) => normalizeStretchList([...current, newStretch]));
    setRoutine((current) => normalizeStretchList([...current, newStretch]));
    setExpandedStretchId(newStretch.id);
    setCustomStretch({
      name: "",
      area: "",
      duration: "30",
      note: "",
      cue: "",
      focus: "Mobility",
      reps: "",
      imageUrl: ""
    });
  };

  const updateStretch = (stretchId: string, updates: Partial<Stretch>) => {
    const applyUpdates = (stretch: Stretch) =>
      stretch.id === stretchId ? normalizeStretch({ ...stretch, ...updates, id: stretch.id }, 0) : stretch;

    setStretchLibrary((current) => current.map(applyUpdates));
    setRoutine((current) => current.map(applyUpdates));
  };

  const toggleStretchInRoutine = (stretch: Stretch) => {
    const existsInRoutine = routine.some((item) => item.id === stretch.id);

    setRoutine((current) => {
      if (existsInRoutine) {
        if (current.length <= 1) return current;

        const nextRoutine = current.filter((item) => item.id !== stretch.id);
        const removedIndex = current.findIndex((item) => item.id === stretch.id);

        setCompleted((items) => items.filter((index) => index !== removedIndex));
        setSkipped((items) => items.filter((index) => index !== removedIndex));
        setActiveIndex((index) => Math.min(index, Math.max(0, nextRoutine.length - 1)));

        return nextRoutine;
      }

      return [...current, stretch];
    });
    setIsRunning(false);
    setSecondsLeft(0);
  };

  const moveRoutineStretch = (stretchId: string, direction: -1 | 1) => {
    setRoutine((current) => {
      const currentIndex = current.findIndex((stretch) => stretch.id === stretchId);
      const nextIndex = currentIndex + direction;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const nextRoutine = [...current];
      [nextRoutine[currentIndex], nextRoutine[nextIndex]] = [nextRoutine[nextIndex], nextRoutine[currentIndex]];

      setActiveIndex((index) => {
        if (index === currentIndex) return nextIndex;
        if (index === nextIndex) return currentIndex;
        return index;
      });

      return nextRoutine;
    });
  };

  const appBackground = theme === "dark" ? "bg-[#0b1020] text-white" : "bg-[#f5f5f7] text-[#111113]";
  const mutedText = theme === "dark" ? "text-[#b9c2d5]" : "text-[#6e6e73]";
  const panelClass = theme === "dark" ? "bg-[#111827] border border-white/10" : "bg-white";
  const softPanelClass = theme === "dark" ? "bg-[#182235] border border-white/10" : "bg-[#f2f2f7]";
  const navClass = theme === "dark" ? "bg-[#111827]/90 border-white/10" : "bg-white/85 border-black/10";

  if (!stretchLibrary.length) {
    return null;
  }

  return (
    <main className={`min-h-screen ${appBackground}`}>
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:max-w-lg">
        <header className={`sticky top-0 z-10 -mx-4 px-4 pb-3 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur-xl ${theme === "dark" ? "bg-[#0b1020]/85" : "bg-[#f5f5f7]/85"}`}>
          <div className="flex items-center justify-between gap-3">
            {view === "today" ? (
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
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-2 text-[12px] font-bold uppercase ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-white text-[#111113]"}`}>
                {formatShortDate()}
              </span>
              <button
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
                className={`grid h-10 w-10 place-items-center rounded-full text-lg shadow-[0_1px_2px_rgba(0,0,0,0.08)] ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-white text-[#111113]"}`}
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
                type="button"
              >
                {theme === "light" ? "☾" : "☀"}
              </button>
            </div>
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
            <div className={`mt-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 rounded-xl p-1 ${theme === "dark" ? "bg-[#182235]" : "bg-[#e5e5ea]"}`}>
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
                onClick={() => setIsRunning(false)}
                type="button"
              >
                Pause
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
                  onClick={handleSkipCurrent}
                  type="button"
                >
                  Skip
                </button>
              </div>

              <h3 className="mt-6 text-[18px] font-bold">Stats</h3>
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
            </section>

            <section className={`mt-5 ${panelClass}`}>
              <div className="flex items-center justify-between px-1 py-3">
                <h2 className="text-[22px] font-bold">Daily Routine</h2>
                <span className={`text-[15px] font-semibold ${mutedText}`}>
                  {Math.round(routineLength / 60)} min
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-transparent">
                {routine.map((stretch, index) => {
                  const done = completed.includes(index);
                  const wasSkipped = skipped.includes(index);

                  return (
                    <div className={`flex w-full items-center gap-3 border-b px-4 py-3 last:border-b-0 ${theme === "dark" ? "border-white/10" : "border-[#f2f2f7]"}`} key={`${stretch.name}-${index}`}>
                      <button
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => handleStretchChange(index)}
                        type="button"
                      >
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                            done
                              ? "bg-[#dff6e8] text-[#1f8f57]"
                              : wasSkipped
                                ? "bg-[#ffe4e0] text-[#c32f27]"
                                : index === activeIndex
                                  ? "bg-[#007aff] text-white"
                                  : theme === "dark"
                                    ? "bg-[#182235] text-[#dfe8ff]"
                                    : "bg-[#f2f2f7] text-[#6e6e73]"
                          }`}
                        >
                          {done ? "✓" : wasSkipped ? "!" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[17px]">{stretch.name}</strong>
                          <span className={`mt-0.5 block text-[14px] ${mutedText}`}>{stretch.area}</span>
                        </span>
                        <span className={`text-[15px] font-semibold ${theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}>
                          {Math.round(stretch.duration * paceMultiplier[pace])}s
                        </span>
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
                <p className={`text-[12px] font-semibold uppercase ${mutedText}`}>Stretch library</p>
                <h2 className="text-[28px] font-bold">Database</h2>
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Library</div>
                  <div className="mt-1 text-[24px] font-bold">{stretchLibrary.length}</div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>In plan</div>
                  <div className="mt-1 text-[24px] font-bold">{routine.length}</div>
                </div>
                <div className={`rounded-2xl ${softPanelClass} p-3`}>
                  <div className={`text-[11px] font-semibold uppercase ${mutedText}`}>Time</div>
                  <div className="mt-1 text-[20px] font-bold">{Math.round(routineLength / 60)}m</div>
                </div>
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
                <h3 className="text-[20px] font-bold">Add stretch</h3>
                <div className="mt-4 space-y-3">
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
                          setCustomStretch((current) => ({ ...current, reps: event.target.value }))
                        }
                        placeholder="Reps"
                        value={customStretch.reps}
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
                          setCustomStretch((current) => ({ ...current, area: event.target.value }))
                        }
                        placeholder="Area"
                        value={customStretch.area}
                      />
                    </div>

                    <input
                      className={`h-11 w-full rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                      onChange={(event) =>
                        setCustomStretch((current) => ({ ...current, imageUrl: event.target.value }))
                      }
                      placeholder="Image URL"
                      value={customStretch.imageUrl}
                    />

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
                      placeholder="Description / notes"
                      value={customStretch.note}
                    />

                    <button
                      className={`h-11 w-full rounded-xl text-[14px] font-semibold ${theme === "dark" ? "bg-[#dfe8ff] text-[#111827]" : "bg-[#111113] text-white"}`}
                      onClick={addCustomStretch}
                      type="button"
                    >
                      Add to database
                    </button>
                  </div>
              </div>

            <div className="space-y-3">
              {stretchLibrary.map((stretch) => {
                const isInRoutine = routine.some((item) => item.id === stretch.id);
                const routineIndex = routine.findIndex((item) => item.id === stretch.id);
                const isExpanded = expandedStretchId === stretch.id;

                return (
                  <div
                    className={`rounded-[24px] border p-4 ${isInRoutine ? "border-[#34c759]" : theme === "dark" ? "border-white/10" : "border-[#e5e5ea]"} ${panelClass}`}
                    key={stretch.id}
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-[18px] font-bold">{stretch.name}</span>
                        <span className={`mt-0.5 block text-[13px] ${mutedText}`}>
                          {stretch.area} · {stretch.reps || "No reps"} · {stretch.duration}s
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          aria-label={isInRoutine ? `Remove ${stretch.name} from plan` : `Add ${stretch.name} to plan`}
                          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${isInRoutine ? "bg-[#dff6e8] text-[#1f8f57]" : theme === "dark" ? "bg-[#182235] text-[#c5d2ec]" : "bg-[#f2f2f7] text-[#8e8e93]"}`}
                          onClick={() => toggleStretchInRoutine(stretch)}
                          type="button"
                        >
                          {isInRoutine ? "✓" : ""}
                        </button>
                        <button
                          aria-label={`Edit ${stretch.name}`}
                          className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${isExpanded ? "bg-[#007aff] text-white" : theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#f2f2f7] text-[#111113]"}`}
                          onClick={() => setExpandedStretchId(isExpanded ? null : stretch.id)}
                          type="button"
                        >
                          ✎
                        </button>
                        <div className={`flex rounded-full ${theme === "dark" ? "bg-[#182235]" : "bg-[#f2f2f7]"}`}>
                          <button
                            aria-label={`Move ${stretch.name} up`}
                            className="grid h-8 w-7 place-items-center text-sm font-bold disabled:opacity-30"
                            disabled={!isInRoutine || routineIndex <= 0}
                            onClick={() => moveRoutineStretch(stretch.id, -1)}
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label={`Move ${stretch.name} down`}
                            className="grid h-8 w-7 place-items-center text-sm font-bold disabled:opacity-30"
                            disabled={!isInRoutine || routineIndex === routine.length - 1}
                            onClick={() => moveRoutineStretch(stretch.id, 1)}
                            type="button"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          aria-label={`Remove ${stretch.name} from plan`}
                          className={`grid h-8 w-8 place-items-center rounded-full text-lg font-bold ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#f2f2f7] text-[#6e6e73]"} disabled:opacity-30`}
                          disabled={!isInRoutine || routine.length <= 1}
                          onClick={() => isInRoutine ? toggleStretchInRoutine(stretch) : undefined}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 space-y-3">
                        {stretch.imageUrl ? (
                          <div
                            aria-hidden="true"
                            className="h-32 w-full rounded-2xl bg-cover bg-center"
                            style={{ backgroundImage: `url(${stretch.imageUrl})` }}
                          />
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                            onChange={(event) => updateStretch(stretch.id, { name: event.target.value })}
                            value={stretch.name}
                          />
                          <input
                            className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                            onChange={(event) => updateStretch(stretch.id, { reps: event.target.value })}
                            placeholder="Reps"
                            value={stretch.reps || ""}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                            onChange={(event) => updateStretch(stretch.id, { duration: Number(event.target.value) || 0 })}
                            type="number"
                            value={stretch.duration}
                          />
                          <input
                            className={`h-11 rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                            onChange={(event) => updateStretch(stretch.id, { area: event.target.value })}
                            value={stretch.area}
                          />
                        </div>

                        <input
                          className={`h-11 w-full rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                          onChange={(event) => updateStretch(stretch.id, { imageUrl: event.target.value })}
                          placeholder="Image URL"
                          value={stretch.imageUrl || ""}
                        />

                        <input
                          className={`h-11 w-full rounded-xl border px-3 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                          onChange={(event) => updateStretch(stretch.id, { cue: event.target.value })}
                          value={stretch.cue}
                        />

                        <textarea
                          className={`min-h-[88px] w-full rounded-xl border px-3 py-2 text-[14px] outline-none ${theme === "dark" ? "border-white/10 bg-[#182235] text-white" : "border-[#e5e5ea] bg-white text-[#111113]"}`}
                          onChange={(event) => updateStretch(stretch.id, { note: event.target.value })}
                          value={stretch.note}
                        />

                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {view === "stats" ? (
          <section className="mt-5 space-y-4">
            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>This week</div>
                  <div className="text-[26px] font-bold">{Math.round(weeklyProgressPct)}%</div>
                </div>
                <div className="text-[12px] font-semibold text-[#0b57d0]">
                  {completedWeeklyStretches}/{weeklyStretchTarget} stretches
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
                <div
                  className="h-full rounded-full bg-[#34c759]"
                  style={{ width: `${weeklyProgressPct}%` }}
                />
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setWeeklyStatsOpen((current) => !current)}
                type="button"
              >
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Weekly stats</div>
                  <div className="text-[30px] font-bold">{completedWeeklyStretches} stretches</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${theme === "dark" ? "bg-[#182235] text-[#dfe8ff]" : "bg-[#eef3ff] text-[#0b57d0]"}`}>
                  {weeklyStatsOpen ? "Hide" : "Show"}
                </span>
              </button>

              <div className="mt-4 grid grid-cols-7 gap-2">
                {weeklyDateKeys.map((dateKey) => {
                    const log = progress.dailyLogs[dateKey] ?? emptyDailyLog();
                    const totalAttempts = log.completed + log.skipped;
                    const completePct = totalAttempts ? Math.round((log.completed / totalAttempts) * 100) : 0;
                    const difficultyPct = log.difficultyEntries
                      ? Math.round((log.difficultyTotal / (log.difficultyEntries * 5)) * 100)
                      : 0;
                    const avgSeconds = log.timedSessions
                      ? Math.round(log.totalSeconds / log.timedSessions)
                      : null;
                    const difficultyColor = difficultyPct >= 70
                      ? "bg-[#ff3b30]"
                      : difficultyPct >= 40
                        ? "bg-[#ff9500]"
                        : "bg-[#34c759]";
                    const day = new Date(`${dateKey}T00:00:00`).toLocaleDateString("en", {
                      weekday: "short"
                    }).slice(0, 1);
                    const hasProgress = log.completed > 0 || log.skipped > 0;

                    return (
                      <div className="text-center" key={dateKey}>
                        <div className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold ${
                          hasProgress
                            ? "bg-[#34c759] text-white"
                            : theme === "dark"
                              ? "bg-[#182235] text-[#c5d2ec]"
                              : "bg-[#f2f2f7] text-[#8e8e93]"
                        }`}>
                          {day}
                        </div>
                        <div className={`mt-1 text-[10px] font-bold ${mutedText}`}>{log.completed}</div>

                        {weeklyStatsOpen ? (
                          <div className={`mt-2 rounded-xl p-2 ${theme === "dark" ? "bg-[#182235]" : "bg-[#f2f2f7]"}`}>
                            <div className="text-[10px] font-bold text-[#166c42]">{completePct}%</div>
                            <div className={`text-[8px] font-semibold uppercase ${mutedText}`}>Done</div>
                            <div className={`mx-auto mt-2 h-2 w-2 rounded-full ${difficultyColor}`} />
                            <div className="mt-1 text-[10px] font-bold">{difficultyPct}%</div>
                            <div className={`text-[8px] font-semibold uppercase ${mutedText}`}>Diff.</div>
                            <div className="mt-2 text-[10px] font-bold tabular-nums">
                              {avgSeconds === null ? "N/A" : formatTime(avgSeconds)}
                            </div>
                            <div className={`text-[8px] font-semibold uppercase ${mutedText}`}>Avg.</div>
                          </div>
                        ) : null}
                      </div>
                    );
                })}
              </div>
            </div>

            <div className={`rounded-[28px] p-4 ${panelClass}`}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className={`text-[12px] font-semibold uppercase ${mutedText}`}>Calendar</div>
                  <h3 className="text-[20px] font-bold">
                    {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString("en", {
                      month: "long",
                      year: "numeric"
                    })}
                  </h3>
                </div>
                <span className={`text-[12px] font-semibold ${mutedText}`}>
                  {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString("en-GB")}
                </span>
              </div>

              <div className={`grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase ${mutedText}`}>
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                  <div key={`${day}-${index}`}>{day}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {monthDateKeys.map((dateKey, index) => {
                  if (!dateKey) {
                    return <div className="aspect-square" key={`blank-${index}`} />;
                  }

                  const log = progress.dailyLogs[dateKey] ?? emptyDailyLog();
                  const isSelected = selectedCalendarDate === dateKey;
                  const hasProgress = log.completed > 0 || log.skipped > 0;
                  const date = new Date(`${dateKey}T00:00:00`);

                  return (
                    <button
                      className={`aspect-square rounded-xl text-[12px] font-bold transition ${
                        isSelected
                          ? "bg-[#007aff] text-white"
                          : hasProgress
                            ? "bg-[#34c759]/20 text-[#166c42]"
                            : theme === "dark"
                              ? "bg-[#182235] text-[#c5d2ec]"
                              : "bg-[#f2f2f7] text-[#6e6e73]"
                      }`}
                      key={dateKey}
                      onClick={() => setSelectedCalendarDate(dateKey)}
                      type="button"
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className={`mt-4 rounded-2xl p-3 ${theme === "dark" ? "bg-[#182235]" : "bg-[#f2f2f7]"}`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold">
                    {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString("en", {
                      weekday: "long",
                      day: "numeric",
                      month: "short"
                    })}
                  </h4>
                  <span className={`text-[12px] font-semibold ${mutedText}`}>
                    {selectedDailyLog.completed} completed
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className={`${theme === "dark" ? "bg-[#111827]" : "bg-white"} rounded-2xl p-3`}>
                    <div className={`text-[10px] font-semibold uppercase ${mutedText}`}>Complete</div>
                    <div className="mt-1 text-[20px] font-bold">{selectedCompletionPct}%</div>
                  </div>
                  <div className={`${theme === "dark" ? "bg-[#111827]" : "bg-white"} rounded-2xl p-3`}>
                    <div className={`text-[10px] font-semibold uppercase ${mutedText}`}>Difficulty</div>
                    <div className="mt-1 text-[20px] font-bold">{selectedDifficultyPct}%</div>
                  </div>
                  <div className={`${theme === "dark" ? "bg-[#111827]" : "bg-white"} rounded-2xl p-3`}>
                    <div className={`text-[10px] font-semibold uppercase ${mutedText}`}>Avg. time</div>
                    <div className="mt-1 text-[14px] font-bold tabular-nums">
                      {selectedAvgSeconds === null ? "N/A" : formatTime(selectedAvgSeconds)}
                    </div>
                  </div>
                </div>
                <div className={`mt-3 text-[12px] font-semibold ${mutedText}`}>
                  Total time: {selectedDailyLog.totalSeconds ? formatTime(selectedDailyLog.totalSeconds) : "N/A"} · Skipped: {selectedDailyLog.skipped}
                </div>
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
              className={`ios-tab ${view === "stats" ? "text-[#007aff]" : theme === "dark" ? "text-[#c5d2ec]" : "text-[#8e8e93]"}`}
              onClick={() => setView("stats")}
              type="button"
            >
              <span>◌</span>
              <span>Stats</span>
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
