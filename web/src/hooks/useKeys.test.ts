import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useKeys } from "./useKeys";

const key = (type: "keydown" | "keyup", k: string) => {
  const e = new KeyboardEvent(type, { key: k, cancelable: true });
  window.dispatchEvent(e);
  return e;
};

describe("useKeys", () => {
  it("tracks held movement and fire keys", () => {
    const { result } = renderHook(() => useKeys());
    key("keydown", "ArrowLeft");
    key("keydown", " ");
    expect(result.current.current).toEqual({ left: true, right: false, fire: true });
    key("keyup", "ArrowLeft");
    key("keyup", " ");
    expect(result.current.current).toEqual({ left: false, right: false, fire: false });
  });

  it("keeps Space from pressing a focused button (such as the topbar pause)", () => {
    renderHook(() => useKeys());
    expect(key("keydown", " ").defaultPrevented).toBe(true);
    expect(key("keydown", "ArrowUp").defaultPrevented).toBe(true);
  });

  it("lets go of every key when the window loses focus, so the ship doesn't keep moving", () => {
    const { result } = renderHook(() => useKeys());
    key("keydown", "ArrowRight");
    key("keydown", "w");
    window.dispatchEvent(new Event("blur"));
    expect(result.current.current).toEqual({ left: false, right: false, fire: false });
  });

  it("stops listening when unmounted", () => {
    const { result, unmount } = renderHook(() => useKeys());
    const keys = result.current;
    unmount();
    key("keydown", "ArrowLeft");
    expect(keys.current.left).toBe(false);
  });
});
