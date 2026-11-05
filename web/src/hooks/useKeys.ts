import { useEffect, useRef } from "react";

export interface Keys {
  left: boolean;
  right: boolean;
  fire: boolean;
}

const LEFT = ["ArrowLeft", "a"];
const RIGHT = ["ArrowRight", "d"];
const FIRE = [" ", "ArrowUp", "w"];

/**
 * Which game keys are held. Space and Up keep their default action off, so a
 * focused button is never pressed by them. Leaving the window lets go of every
 * key, since its keyup never arrives.
 */
export function useKeys() {
  const keys = useRef<Keys>({ left: false, right: false, fire: false });

  useEffect(() => {
    const set = (e: KeyboardEvent, held: boolean) => {
      if (LEFT.includes(e.key)) keys.current.left = held;
      if (RIGHT.includes(e.key)) keys.current.right = held;
      if (FIRE.includes(e.key)) {
        keys.current.fire = held;
        if (held) e.preventDefault();
      }
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    const release = () => {
      keys.current = { left: false, right: false, fire: false };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, []);

  return keys;
}
