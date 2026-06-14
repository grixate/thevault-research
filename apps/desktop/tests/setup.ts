import { vi } from "vitest";

vi.stubGlobal("ResizeObserver", class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});

Element.prototype.scrollIntoView = vi.fn();
