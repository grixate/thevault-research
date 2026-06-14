import { describe, expect, it } from "vitest";
import { isTrustedAppUrl, originKey, shouldGrantPermissionRequest } from "../electron/security";

describe("Electron security policy", () => {
  it("normalizes app origins for dev and packaged URLs", () => {
    expect(originKey("http://localhost:5173/index.html")).toBe("http://localhost:5173");
    expect(originKey("file:///Applications/The%20Vault/index.html")).toBe("file:");
  });

  it("trusts only configured app origins", () => {
    expect(isTrustedAppUrl("http://localhost:5173/index.html", ["http://localhost:5173"])).toBe(true);
    expect(isTrustedAppUrl("file:///Applications/The%20Vault/index.html", ["file:"])).toBe(true);
    expect(isTrustedAppUrl("https://example.com/prompt", ["http://localhost:5173"])).toBe(false);
    expect(isTrustedAppUrl("not a url", ["http://localhost:5173"])).toBe(false);
  });

  it("allows app-origin microphone permission and denies broader permissions", () => {
    const allowedOrigins = ["http://localhost:5173"];
    expect(
      shouldGrantPermissionRequest(
        "media",
        { requestingUrl: "http://localhost:5173/settings", mediaTypes: ["audio"] },
        allowedOrigins
      )
    ).toBe(true);
    expect(
      shouldGrantPermissionRequest(
        "media",
        { requestingUrl: "http://localhost:5173/settings", mediaTypes: ["audio", "video"] },
        allowedOrigins
      )
    ).toBe(false);
    expect(
      shouldGrantPermissionRequest(
        "media",
        { requestingUrl: "https://example.com/settings", mediaTypes: ["audio"] },
        allowedOrigins
      )
    ).toBe(false);
    expect(shouldGrantPermissionRequest("notifications", { requestingUrl: "http://localhost:5173/settings" }, allowedOrigins)).toBe(false);
  });
});
