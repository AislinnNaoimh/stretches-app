"use client";

import { useMemo, useState } from "react";

type Stretch = {
  name: string;
  area: string;
  duration: string;
  note: string;
};

const stretches: Stretch[] = [
  {
    name: "Neck release",
    area: "Upper body",
    duration: "45 sec",
    note: "Drop one ear toward your shoulder and breathe into the side of the neck."
  },
  {
    name: "Chest opener",
    area: "Posture",
    duration: "60 sec",
    note: "Interlace fingers behind your back, lift the chest, and keep the ribs soft."
  },
  {
    name: "Hip flexor lunge",
    area: "Hips",
    duration: "75 sec",
    note: "Tuck the pelvis gently and shift forward until the front of the hip opens."
  },
  {
    name: "Hamstring fold",
    area: "Legs",
    duration: "60 sec",
    note: "Hinge from the hips with a long spine and keep a small bend in the knee."
  }
];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStretch = stretches[activeIndex];

  const routineLength = useMemo(
    () => stretches.reduce((total, stretch) => total + Number.parseInt(stretch.duration, 10), 0),
    []
  );

  return (
    <main className="min-h-screen bg-[#f6f3ed] text-[#242424]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d1c4] pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a7651]">
              Daily mobility
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-normal sm:text-5xl">
              Stretches App
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-[#d8d1c4] bg-white px-4 py-3">
              <span className="block text-[#6f6b63]">Routine</span>
              <strong>{Math.round(routineLength / 60)} min</strong>
            </div>
            <div className="rounded-lg border border-[#d8d1c4] bg-white px-4 py-3">
              <span className="block text-[#6f6b63]">Moves</span>
              <strong>{stretches.length}</strong>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_360px]">
          <section className="flex min-h-[420px] flex-col justify-between rounded-lg bg-[#26312f] p-6 text-white shadow-sm sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-[#e7be73] px-3 py-1 text-sm font-semibold text-[#2a2112]">
                {activeStretch.area}
              </span>
              <h2 className="mt-6 max-w-2xl text-5xl font-bold tracking-normal sm:text-6xl">
                {activeStretch.name}
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#dce3dc]">
                {activeStretch.note}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
              <div>
                <span className="block text-sm uppercase tracking-[0.16em] text-[#aebbae]">
                  Hold for
                </span>
                <strong className="mt-1 block text-4xl">{activeStretch.duration}</strong>
              </div>
              <div className="flex gap-3">
                <button
                  className="h-12 rounded-md border border-white/25 px-5 font-semibold text-white transition hover:bg-white/10"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === 0 ? stretches.length - 1 : current - 1
                    )
                  }
                  type="button"
                >
                  Back
                </button>
                <button
                  className="h-12 rounded-md bg-[#e7be73] px-5 font-semibold text-[#2a2112] transition hover:bg-[#f0ca83]"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === stretches.length - 1 ? 0 : current + 1
                    )
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-lg border border-[#d8d1c4] bg-white p-4">
            <h2 className="px-2 pb-3 text-lg font-bold">Today&apos;s routine</h2>
            <div className="space-y-2">
              {stretches.map((stretch, index) => (
                <button
                  className={`w-full rounded-md border p-4 text-left transition ${
                    index === activeIndex
                      ? "border-[#6a7651] bg-[#eef2e4]"
                      : "border-[#e7e0d4] bg-white hover:border-[#b8aa93]"
                  }`}
                  key={stretch.name}
                  onClick={() => setActiveIndex(index)}
                  type="button"
                >
                  <span className="text-sm font-semibold text-[#6a7651]">
                    {String(index + 1).padStart(2, "0")} · {stretch.duration}
                  </span>
                  <strong className="mt-1 block text-lg">{stretch.name}</strong>
                  <span className="mt-1 block text-sm text-[#6f6b63]">{stretch.area}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
