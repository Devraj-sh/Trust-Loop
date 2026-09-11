import { useEffect, useState } from "react";

const JUDGE_MODE_STORAGE_KEY = "trustloop_judge_mode";

export function useJudgeMode() {
  const [isJudgeMode, setIsJudgeMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // Default ON for judges
    const stored = localStorage.getItem(JUDGE_MODE_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem(JUDGE_MODE_STORAGE_KEY);
      setIsJudgeMode(stored === null ? true : stored === "true");
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("trustloop:judgemode", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("trustloop:judgemode", handleStorage);
    };
  }, []);

  const toggleJudgeMode = () => {
    const next = !isJudgeMode;
    setIsJudgeMode(next);
    localStorage.setItem(JUDGE_MODE_STORAGE_KEY, String(next));
    window.dispatchEvent(new Event("trustloop:judgemode"));
  };

  return { isJudgeMode, toggleJudgeMode };
}
