import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHighScore } from "./useHighScore";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useHighScore", () => {
  it("loads, raises and saves the best score, never lowering it", () => {
    localStorage.setItem("best", "120");
    const { result } = renderHook(() => useHighScore("best"));
    expect(result.current[0]).toBe(120);
    act(() => result.current[1](90));
    expect(result.current[0]).toBe(120);
    act(() => result.current[1](300));
    expect(result.current[0]).toBe(300);
    expect(localStorage.getItem("best")).toBe("300");
  });

  it("works with localStorage blocked", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    const { result } = renderHook(() => useHighScore("best"));
    expect(result.current[0]).toBe(0);
    act(() => result.current[1](50));
    expect(result.current[0]).toBe(50);
  });
});
