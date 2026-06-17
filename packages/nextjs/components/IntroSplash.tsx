"use client";

import { useEffect, useState } from "react";
import Logo from "~~/components/Logo";

export const IntroSplash = ({ onComplete }: { onComplete: () => void }) => {
  const [visibleChars, setVisibleChars] = useState(0);
  const [fade, setFade] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  const title = "MarketplAIs";
  const displayText = title.slice(0, visibleChars);

  useEffect(() => {
    if (visibleChars < title.length) {
      const timer = setTimeout(() => setVisibleChars(count => count + 1), 40);
      return () => clearTimeout(timer);
    }

    const logoTimer = setTimeout(() => setShowLogo(true), 50);
    const fadeTimer = setTimeout(() => setFade(true), 250);
    const completeTimer = setTimeout(() => onComplete(), 550);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [visibleChars, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-white text-slate-950 flex items-center justify-center transition-opacity duration-700 ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="relative w-full h-full overflow-hidden bg-white">
        {/* Decorative dots */}
        <div className="absolute inset-0 bg-white">
          {[
            "top-12 left-10",
            "top-20 right-12",
            "top-32 left-1/2",
            "top-44 right-1/4",
            "top-56 left-1/4",
            "top-72 right-1/3",
            "top-80 left-3/4",
            "top-24 left-3/4",
            "top-14 right-1/3",
            "top-60 left-3/5",
          ].map((pos, i) => (
            <div key={i} className={`absolute ${pos} text-slate-400 text-xs`}>
              .
            </div>
          ))}
        </div>

        <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
          <div className="flex w-full max-w-5xl flex-col items-center gap-8 rounded-none border border-slate-200/80 bg-slate-50 p-10 shadow-2xl shadow-slate-200/50 sm:flex-row sm:justify-between">
            <div className="min-w-[13rem] flex-1">
              <div className="font-mono text-[3rem] leading-none tracking-[0.04em] text-slate-950 sm:text-[4rem]">
                <span>{displayText}</span>
                <span className="text-slate-400">{visibleChars < title.length ? "_" : ""}</span>
              </div>
            </div>
            {showLogo ? <Logo className="w-40 h-40 sm:w-48 sm:h-48" /> : <div className="h-40 w-40 sm:h-48 sm:w-48" />}
          </div>
        </div>
      </div>
    </div>
  );
};
