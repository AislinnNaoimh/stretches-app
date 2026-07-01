"use client";

import { useMemo, useState } from "react";

type Stretch = {
  name: string;
  area: string;
  duration: number;
  note: string;
  cue: string;
};

const stretches: Stretch[] = [
  {
    name: "Neck release",
    area: "Upper body",
    duration: 45,
    note: "Drop one ear toward your shoulder and breathe into the side of the neck.",
    cue: "Keep the jaw loose"
  },
  {
    name: "Chest opener",
    area: "Posture",
    duration: 60,
    note: "Interlace fingers behind your back, lift the chest, and keep the ribs soft.",
    cue: "Breathe into the ribs"
  },
  {
    name: "Hip flexor lunge",
    area: "Hips",
    duration: 75,
    note: "Tuck the pelvis gently and shift forward until the front of the hip opens.",
    cue: "Glute on, ribs down"
  },
  {
    name: "Hamstring fold",
    area: "Legs",
    duration: 60,
    note: "Hinge from the hips with a long spine and keep a small bend in the knee.",
    cue: "Reach through the heel"
  }
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pace, setPace] = useState<"calm" | "steady" | "deep">("steady");
  const activeStretch = stretches[activeIndex];

  const routineLength = useMemo(
    () => stretches.reduce((total, stretch) => total + stretch.duration, 0),
    []
  );
  const progress = ((activeIndex + 1) / stretches.length) * 100;

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111113]">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:max-w-lg">
        <header className="sticky top-0 z-10 -mx-4 bg-[#f5f5f7]/85 px-4 pb-3 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button
              aria-label="Previous stretch"
              className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl font-medium shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              onClick={() =>
                setActiveIndex((current) => (current === 0 ? stretches.length - 1 : current - 1))
              }
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
              onClick={() =>
                setActiveIndex((current) => (current === stretches.length - 1 ? 0 : current + 1))
              }
              type="button"
            >
              ›
            </button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e5e5ea]">
            <div
              className="h-full rounded-full bg-[#34c759] transition-all duration-300"
              style={{ width: `${progress}%` }}
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
              <span className="text-2xl font-bold">{activeStretch.duration}</span>
              <span className="-mt-3 text-[11px] font-semibold text-[#6e6e73]">sec</span>
            </div>
          </div>

          <div className="mt-6 aspect-[4/3] rounded-[24px] bg-[radial-gradient(circle_at_35%_28%,#ffffff_0,#ffffff_12%,transparent_13%),linear-gradient(145deg,#d7f7df,#b5d8ff_55%,#f8d0d9)] p-4">
            <div className="flex h-full flex-col justify-between rounded-[20px] bg-white/35 p-4 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-full bg-white/70 shadow-inner" />
              <div className="space-y-2">
                <div className="h-4 w-28 rounded-full bg-white/75" />
                <div className="h-4 w-40 rounded-full bg-white/55" />
              </div>
            </div>
          </div>

          <p className="mt-5 text-[17px] leading-7 text-[#3a3a3c]">{activeStretch.note}</p>

          <div className="mt-5 rounded-2xl bg-[#f2f2f7] p-4">
            <span className="text-[12px] font-semibold uppercase text-[#8e8e93]">Cue</span>
            <p className="mt-1 text-[17px] font-semibold">{activeStretch.cue}</p>
          </div>

          <button
            className="mt-5 h-14 w-full rounded-2xl bg-[#111113] text-[17px] font-semibold text-white shadow-[0_10px_20px_rgba(17,17,19,0.16)]"
            onClick={() =>
              setActiveIndex((current) => (current === stretches.length - 1 ? 0 : current + 1))
            }
            type="button"
          >
            Start Hold
          </button>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[22px] font-bold">Routine</h2>
            <span className="text-[15px] font-semibold text-[#6e6e73]">
              {Math.round(routineLength / 60)} min
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white">
            {stretches.map((stretch, index) => (
              <button
                className="flex min-h-20 w-full items-center gap-3 border-b border-[#f2f2f7] px-4 py-3 text-left last:border-b-0"
                key={stretch.name}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    index === activeIndex ? "bg-[#007aff] text-white" : "bg-[#f2f2f7] text-[#6e6e73]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[17px]">{stretch.name}</strong>
                  <span className="mt-0.5 block text-[14px] text-[#6e6e73]">{stretch.area}</span>
                </span>
                <span className="text-[15px] font-semibold text-[#8e8e93]">{stretch.duration}s</span>
              </button>
            ))}
          </div>
        </section>

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
