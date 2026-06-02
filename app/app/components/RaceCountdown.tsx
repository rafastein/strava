"use client";

import { useEffect, useState } from "react";

type Props = {
  targetDate: string; // ISO string
  raceName?: string;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center justify-center rounded-2xl bg-white/20 px-3 py-2 min-w-[52px]">
        <span className="text-2xl font-bold tabular-nums leading-none text-white">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs font-medium uppercase tracking-wider text-orange-100">
        {label}
      </span>
    </div>
  );
}

export default function RaceCountdown({ targetDate, raceName }: Props) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calcTimeLeft(targetDate));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) {
    return (
      <div className="flex gap-3">
        {["dias", "horas", "min", "seg"].map((l) => (
          <Digit key={l} value={0} label={l} />
        ))}
      </div>
    );
  }

  const finished = timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (finished) {
    return (
      <div className="rounded-2xl bg-white/20 px-4 py-3">
        <p className="text-lg font-bold text-white">
          🎉 {raceName ?? "Prova"} chegou!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Digit value={timeLeft.days} label="dias" />
      <Digit value={timeLeft.hours} label="horas" />
      <Digit value={timeLeft.minutes} label="min" />
      <Digit value={timeLeft.seconds} label="seg" />
    </div>
  );
}
