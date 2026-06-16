import { app, BrowserWindow, Menu, dialog, globalShortcut, ipcMain, shell, type MenuItemConstructorOptions } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allowedRoutes, isVaultRoute } from "./ipc/routes.js";
import { audioRecordingSchema, fileImportSchema, requestSchema, textFileSaveSchema } from "./ipc/validators.js";
import { installPermissionPolicy } from "./security.js";
import { startCoreService, type CoreHandle } from "./services/coreProcess.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_AUDIO_RECORDING_BYTES = 80 * 1024 * 1024;
const MAX_REGISTRY_FILE_BYTES = 5 * 1024 * 1024;
const QUICK_NOTE_ACCELERATOR = "CommandOrControl+Shift+N";
const QUICK_TASK_ACCELERATOR = "CommandOrControl+Shift+T";
const QUICK_SOURCE_ACCELERATOR = "CommandOrControl+Shift+E";
const SEARCH_ACCELERATOR = "CommandOrControl+K";
let mainWindow: BrowserWindow | null = null;
let core: CoreHandle | null = null;

async function createWindow() {
  core = await startCoreService();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 760,
    title: "The Vault Research Lab",
    backgroundColor: "#f7f5ef",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  installPermissionPolicy(mainWindow);

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith("file:");
    if (!allowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function openQuickNote() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("vault:quickNote");
}

function openQuickTask() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("vault:quickTask");
}

function openQuickSource() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("vault:addSource");
}

function focusCommandSearch() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("vault:focusSearch");
}

function installApplicationMenu() {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const }
            ]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Quick Note",
          accelerator: QUICK_NOTE_ACCELERATOR,
          click: openQuickNote
        },
        {
          label: "Quick Task",
          accelerator: QUICK_TASK_ACCELERATOR,
          click: openQuickTask
        },
        {
          label: "Add Source",
          accelerator: QUICK_SOURCE_ACCELERATOR,
          click: openQuickSource
        },
        {
          label: "Search Vault",
          accelerator: SEARCH_ACCELERATOR,
          click: focusCommandSearch
        },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerGlobalShortcuts() {
  const quickNoteRegistered = globalShortcut.register(QUICK_NOTE_ACCELERATOR, openQuickNote);
  if (!quickNoteRegistered) {
    console.warn(`Could not register ${QUICK_NOTE_ACCELERATOR} for Quick Note.`);
  }
  const quickTaskRegistered = globalShortcut.register(QUICK_TASK_ACCELERATOR, openQuickTask);
  if (!quickTaskRegistered) {
    console.warn(`Could not register ${QUICK_TASK_ACCELERATOR} for Quick Task.`);
  }
  const quickSourceRegistered = globalShortcut.register(QUICK_SOURCE_ACCELERATOR, openQuickSource);
  if (!quickSourceRegistered) {
    console.warn(`Could not register ${QUICK_SOURCE_ACCELERATOR} for Add Source.`);
  }
  const searchRegistered = globalShortcut.register(SEARCH_ACCELERATOR, focusCommandSearch);
  if (!searchRegistered) {
    console.warn(`Could not register ${SEARCH_ACCELERATOR} for Search Vault.`);
  }
}

ipcMain.handle("vault:request", async (_event, input) => {
  if (!core) throw new Error("Core service is not running.");
  const parsed = requestSchema.parse(input);
  if (!isVaultRoute(parsed.route)) throw new Error(`Route not allowed: ${parsed.route}`);
  const spec = allowedRoutes[parsed.route];
  const routePayload = parsed.payload as any;
  if (parsed.route === "sources.importFiles") {
    fileImportSchema.parse(routePayload);
  }
  const response = await fetch(`${core.baseUrl}${spec.path(routePayload)}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${core.token}`,
      "Content-Type": "application/json"
    },
    body: spec.method === "GET" ? undefined : JSON.stringify(spec.body?.(routePayload) ?? {})
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Vault Core returned ${response.status}`);
  }
  return response.json();
});

ipcMain.handle("vault:selectFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Research sources", extensions: ["md", "markdown", "txt", "pdf"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("vault:selectAudioFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Audio and video sources", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "opus", "webm", "mp4", "mov"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("vault:selectModelFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: [
      { name: "GGUF local models", extensions: ["gguf"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("vault:selectRegistryFiles", async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "AI registry JSON", extensions: ["json"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return [];
  return Promise.all(
    result.filePaths.map(async (filePath) => {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw new Error(`Registry selection is not a file: ${filePath}`);
      if (stat.size > MAX_REGISTRY_FILE_BYTES) throw new Error(`Registry file is too large: ${path.basename(filePath)}`);
      const contents = await fs.readFile(filePath, "utf-8");
      return { filePath, filename: path.basename(filePath), contents };
    })
  );
});

ipcMain.handle("vault:saveAudioRecording", async (_event, input) => {
  const parsed = audioRecordingSchema.parse(input);
  const bytes =
    parsed.data instanceof ArrayBuffer
      ? Buffer.from(parsed.data)
      : Buffer.from(parsed.data.buffer, parsed.data.byteOffset, parsed.data.byteLength);
  if (bytes.byteLength === 0) throw new Error("Recording did not contain audio data.");
  if (bytes.byteLength > MAX_AUDIO_RECORDING_BYTES) throw new Error("Recording is too large to save.");
  const mimeType = parsed.mimeType || "audio/webm";
  const extension = audioExtensionForMimeType(mimeType);
  const recordingDir = path.join(app.getPath("temp"), "vault-research-lab", "recordings");
  await fs.mkdir(recordingDir, { recursive: true });
  const filePath = path.join(recordingDir, `vault-recording-${Date.now()}-${randomUUID()}${extension}`);
  await fs.writeFile(filePath, bytes);
  return { filePath, mimeType, sizeBytes: bytes.byteLength };
});

ipcMain.handle("vault:saveTextFile", async (_event, input) => {
  const parsed = textFileSaveSchema.parse(input);
  const safeFilename = parsed.filename.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "vault-export.md";
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: safeFilename,
    filters: textSaveFilters(parsed.mimeType)
  });
  if (result.canceled || !result.filePath) {
    return { saved: false, filePath: null };
  }
  await fs.writeFile(result.filePath, parsed.contents, "utf-8");
  return { saved: true, filePath: result.filePath, mimeType: parsed.mimeType ?? "text/markdown", sizeBytes: Buffer.byteLength(parsed.contents, "utf-8") };
});

function textSaveFilters(mimeType?: string) {
  if (mimeType === "application/json") {
    return [
      { name: "JSON", extensions: ["json"] },
      { name: "Text", extensions: ["txt"] }
    ];
  }
  return [
    { name: "Markdown", extensions: ["md", "markdown"] },
    { name: "Text", extensions: ["txt"] }
  ];
}

function audioExtensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return ".mp3";
  if (normalized.includes("mp4") || normalized.includes("aac")) return ".m4a";
  if (normalized.includes("ogg")) return ".ogg";
  if (normalized.includes("webm")) return ".webm";
  throw new Error(`Unsupported recording MIME type: ${mimeType}`);
}

app.whenReady().then(async () => {
  installApplicationMenu();
  await createWindow();
  registerGlobalShortcuts();
});

app.on("before-quit", () => {
  core?.stop();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
