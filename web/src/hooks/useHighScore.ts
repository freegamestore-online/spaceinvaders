import { useCallback, useState } from "react";

function readBest(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) ?? "", 10) || 0;
  } catch {
    return 0; // Storage blocked: start from zero.
  }
}

/**
 * Persist a high score in localStorage.
 * Returns [highScore, updateIfHigher].
 */
export function useHighScore(key: string): [number, (score: number) => void] {
  const [highScore, setHighScore] = useState(() => readBest(key));

  const update = useCallback(
    (score: number) => {
      if (score > highScore) {
        setHighScore(score);
        try {
          localStorage.setItem(key, String(score));
        } catch {
          // Storage blocked or full: the best score just isn't kept.
        }
      }
    },
    [key, highScore],
  );

  return [highScore, update];
}
