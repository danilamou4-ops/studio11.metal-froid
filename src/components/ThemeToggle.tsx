"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mf-theme");
    const light = saved === "light";
    setIsLight(light);
    if (light) {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      localStorage.setItem("mf-theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("mf-theme", "dark");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Passer en mode sombre" : "Passer en mode clair"}
      className="rounded-[var(--radius)] border border-border p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {isLight ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
