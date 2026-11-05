import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  localStorage.clear();
});

describe("App", () => {
  it("goes from the start screen to play, pause and back", () => {
    render(<App />);
    expect(screen.getByText("Defend the base")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.queryByText("Defend the base")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Paused")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /pause|resume|play/i }));
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });
});
