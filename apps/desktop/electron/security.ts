import type { BrowserWindow } from "electron";

export type PermissionRequestDetails = {
  requestingUrl?: string;
  mediaTypes?: string[];
};

export function defaultAllowedAppOrigins(devServerUrl = process.env.VITE_DEV_SERVER_URL): string[] {
  if (devServerUrl) return [originKey(devServerUrl)];
  return ["file:"];
}

export function originKey(url: string): string {
  if (url.startsWith("file:")) return "file:";
  return new URL(url).origin;
}

export function isTrustedAppUrl(url: string | undefined, allowedOrigins = defaultAllowedAppOrigins()): boolean {
  if (!url) return false;
  try {
    return allowedOrigins.includes(originKey(url));
  } catch {
    return false;
  }
}

export function shouldGrantPermissionRequest(
  permission: string,
  details: PermissionRequestDetails,
  allowedOrigins = defaultAllowedAppOrigins()
): boolean {
  if (permission !== "media") return false;
  if (!isTrustedAppUrl(details.requestingUrl, allowedOrigins)) return false;

  const mediaTypes = details.mediaTypes ?? [];
  return mediaTypes.includes("audio") && !mediaTypes.includes("video");
}

export function installPermissionPolicy(window: BrowserWindow, allowedOrigins = defaultAllowedAppOrigins()): void {
  window.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const fromVaultWindow = webContents === window.webContents;
    callback(fromVaultWindow && shouldGrantPermissionRequest(permission, details, allowedOrigins));
  });
}
