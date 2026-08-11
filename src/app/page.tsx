"use client";

import { useEffect, useMemo, useState } from "react";

type Pace = "calm" | "steady" | "deep";

type Stretch = {
  name: string;
  area: string;
  duration: number;
  note: string;
  cue: string;
  focus: string;
};

type ProgressState = {
  completedSessions: number;
  totalMinutes: number;
  lastCompletedDate: string | null;
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

const paceMultiplier: Record<Pace, number> = {
  calm: 0.85,
  steady: 1,
  deep: 1.2
};

const routineStorageKey = "stretch-routine-v1";
const progressStorageKey = "stretch-progress-v1";

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
  if (typeof window === "undefined") {
    return { completedSessions: 0, totalMinutes: 0, lastCompletedDate: null };
  }

  const saved = window.localStorage.getItem(progressStorageKey);
  if (!saved) {
    return { completedSessions: 0, totalMinutes: 0, lastCompletedDate: null };
  }

  try {
    return JSON.parse(saved) as ProgressState;
  } catch {
    return { completedSessions: 0, totalMinutes: 0, lastCompletedDate: null };
  }
}

export default function Home() {
  const [routine, setRoutine] = useState<Stretch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pace, setPace] = useState<Pace>("steady");
  const [isRunning, setIsRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    completedSessions: 0,
    totalMinutes: 0,
    lastCompletedDate: null
  });
  const [customStretch, setCustomStretch] = useState({
    name: "",
    area: "",
    duration: "30",
    note: "",
    cue: "",
    focus: "Mobility"
  });

  useEffect(() => {
    setRoutine(loadSavedRoutine());
    setProgress(loadSavedProgress());
  }, []);

  useEffect(() => {
    if (routine.length === 0) return;
    window.localStorage.setItem(routineStorageKey, JSON.stringify(routine));
  }, [routine]);

  useEffect(() => {
    window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (!routine.length) return;
    setSecondsLeft(Math.round(routine[activeIndex].duration * paceMultiplier[pace]));
    setIsRunning(false);
  }, [activeIndex, pace, routine]);

  useEffect(() => {
    if (!routine.length || !isRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
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
  }, [activeIndex, isRunning, routine]);

  const activeStretch = routine[activeIndex] ?? routine[0];
  const adjustedDuration = activeStretch ? Math.round(activeStretch.duration * paceMultiplier[pace]) : 0;
  const routineLength = useMemo(
    () => routine.reduce((total, stretch) => total + stretch.duration, 0),
    [routine]
  );
  const progressPercent = routine.length ? ((activeIndex + 1) / routine.length) * 100 : 0;
  const sessionComplete = routine.length > 0 && completed.length >= routine.length;

  useEffect(() => {
    if (!sessionComplete) return;

    const today = new Date().toISOString().slice(0, 10);
    const totalRoutineMinutes = Math.round(routineLength / 60);

    setProgress((current) => ({
      completedSessions: current.completedSessions + 1,
      totalMinutes: current.totalMinutes + totalRoutineMinutes,
      lastCompletedDate: today
    }));
    setCompleted([]);
  }, [sessionComplete]);

  const handleStretchChange = (nextIndex: number) => {
    if (!routine.length) return;
    setActiveIndex(nextIndex);
    setIsRunning(false);
    setSecondsLeft(Math.round(routine[nextIndex].duration * paceMultiplier[pace]));
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

  if (!routine.length) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111113]">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:max-w-lg">
        <header className="sticky top-0 z-10 -mx-4 bg-[#f5f5f7]/85 px-4 pb-3 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button
              aria-label="Previous stretch"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              onClick={() => {
                const previousIndex = activeIndex === 0 ? routine.length - 1 : activeIndex - 1;
                handleStretchChange(previousIndex);
              }}
              type="button"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-[#6e6e73]">Daily Mobility</p>
              <h1 className="text-[17px] font-semibold">Stretches</h1>
            </div>
            <button
              aria-label="Next stretch"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#007aff] text-2xl font-medium text-white shadow-[0_6px_14px_rgba(0,122,255,0.28)]"
              onClick={handleNext}
              type="button"
            >
              ›
            </button>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
            <div
              className="h-full rounded-full bg-[#34c759] transition-all duration-300"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </header>

        <div className="mt-4 grid grid-cols-3 rounded-xl bg-[#e5e5ea] p-1">
          {(["calm", "steady", "deep"] as const).map((mode) => (
            <button
              className={`h-9 rounded-lg text-[13px] font-semibold capitalize transition ${
                pace === mode ? "bg-white text-[#111113] shadow-sm" : "text-[#6e6e73]"
              }`}
              key={mode}
              onClick={() => setPace(mode)}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-[28px] bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-[#007aff]">{activeStretch.area}</p>
              <h2 className="mt-2 text-4xl font-bold leading-tight tracking-normal">
                {activeStretch.name}
              </h2>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#f2f2f7] text-center">
              <span className="text-2xl font-bold">{Math.max(1, adjustedDuration)}</span>
              <span className="-mt-3 text-[11px] font-semibold text-[#6e6e73]">sec</span>
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
                <div className="text-5xl font-bold tabular-nums text-[#111113]">{secondsLeft}s</div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[17px] leading-7 text-[#3a3a3c]">{activeStretch.note}</p>

          <div className="mt-5 rounded-2xl bg-[#f2f2f7] p-4">
            <span className="text-[12px] font-semibold uppercase text-[#8e8e93]">Cue</span>
            <p className="mt-1 text-[17px] font-semibold">{activeStretch.cue}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              className="h-14 rounded-2xl bg-[#111113] text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(17,17,19,0.16)]"
              onClick={() => setIsRunning((current) => !current)}
              type="button"
            >
              {isRunning ? "Pause" : "Start hold"}
            </button>
            <button
              className="h-14 rounded-2xl bg-[#eef3ff] text-[17px] font-semibold text-[#0b57d0]"
              onClick={handleNext}
              type="button"
            >
              Skip
            </button>
          </div>
        </section>

        <section className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
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

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-[#f2f2f7] p-3">
              <div className="text-[11px] font-semibold uppercase text-[#6e6e73]">Sessions</div>
              <div className="mt-1 text-[24px] font-bold">{progress.completedSessions}</div>
            </div>
            <div className="rounded-2xl bg-[#f2f2f7] p-3">
              <div className="text-[11px] font-semibold uppercase text-[#6e6e73]">Minutes</div>
              <div className="mt-1 text-[24px] font-bold">{progress.totalMinutes}</div>
            </div>
            <div className="rounded-2xl bg-[#f2f2f7] p-3">
              <div className="text-[11px] font-semibold uppercase text-[#6e6e73]">Last</div>
              <div className="mt-1 text-[12px] font-bold">
                {progress.lastCompletedDate ? progress.lastCompletedDate.slice(5) : "-"}
              </div>
            </div>
          </div>

          {showEditor ? (
            <div className="mt-4 space-y-3 rounded-2xl border border-[#e5e5ea] bg-[#fafafa] p-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-xl border border-[#e5e5ea] bg-white px-3 text-[14px] outline-none"
                  onChange={(event) =>
                    setCustomStretch((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Stretch name"
                  value={customStretch.name}
                />
                <input
                  className="h-11 rounded-xl border border-[#e5e5ea] bg-white px-3 text-[14px] outline-none"
                  onChange={(event) =>
                    setCustomStretch((current) => ({ ...current, area: event.target.value }))
                  }
                  placeholder="Area"
                  value={customStretch.area}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-xl border border-[#e5e5ea] bg-white px-3 text-[14px] outline-none"
                  onChange={(event) =>
                    setCustomStretch((current) => ({ ...current, duration: event.target.value }))
                  }
                  placeholder="Seconds"
                  type="number"
                  value={customStretch.duration}
                />
                <input
                  className="h-11 rounded-xl border border-[#e5e5ea] bg-white px-3 text-[14px] outline-none"
                  onChange={(event) =>
                    setCustomStretch((current) => ({ ...current, focus: event.target.value }))
                  }
                  placeholder="Focus"
                  value={customStretch.focus}
                />
              </div>

              <input
                className="h-11 w-full rounded-xl border border-[#e5e5ea] bg-white px-3 text-[14px] outline-none"
                onChange={(event) =>
                  setCustomStretch((current) => ({ ...current, cue: event.target.value }))
                }
                placeholder="Cue"
                value={customStretch.cue}
              />

              <textarea
                className="min-h-[80px] w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[14px] outline-none"
                onChange={(event) =>
                  setCustomStretch((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Instructions"
                value={customStretch.note}
              />

              <div className="flex gap-2">
                <button
                  className="h-11 flex-1 rounded-xl bg-[#111113] text-[14px] font-semibold text-white"
                  onClick={addCustomStretch}
                  type="button"
                >
                  Add stretch
                </button>
                <button
                  className="h-11 flex-1 rounded-xl bg-[#eef3ff] text-[14px] font-semibold text-[#0b57d0]"
                  onClick={resetToDefault}
                  type="button"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold">Routine</h2>
            <span className="text-[15px] font-semibold text-[#6e6e73]">
              {Math.round(routineLength / 60)} min
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl bg-white">
            {routine.map((stretch, index) => {
              const done = completed.includes(index);

              return (
                <div className="flex w-full items-center gap-3 border-b border-[#f2f2f7] px-4 py-3 last:border-b-0" key={`${stretch.name}-${index}`}>
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
                            : "bg-[#f2f2f7] text-[#6e6e73]"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[17px]">{stretch.name}</strong>
                      <span className="mt-0.5 block text-[14px] text-[#6e6e73]">{stretch.area}</span>
                    </span>
                    <span className="text-[15px] font-semibold text-[#8e8e93]">
                      {Math.round(stretch.duration * paceMultiplier[pace])}s
                    </span>
                  </button>

                  <button
                    aria-label={`Remove ${stretch.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f2f7] text-lg text-[#6e6e73]"
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

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/85 px-6 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-3">
            <button className="ios-tab text-[#007aff]" type="button">
              <span>●</span>
              <span>Today</span>
            </button>
            <button className="ios-tab" type="button">
              <span>○</span>
              <span>Plans</span>
            </button>
            <button className="ios-tab" type="button">
              <span>◌</span>
              <span>Stats</span>
            </button>
          </div>
        </nav>
      </section>
    </main>
  );
}
