import { contextBridge, ipcRenderer } from "electron";
import type { VaultRoute } from "./ipc/routes.js";

contextBridge.exposeInMainWorld("vault", {
  request: (route: VaultRoute, payload?: unknown) => ipcRenderer.invoke("vault:request", { route, payload }),
  selectFiles: () => ipcRenderer.invoke("vault:selectFiles"),
  selectAudioFiles: () => ipcRenderer.invoke("vault:selectAudioFiles"),
  selectModelFiles: () => ipcRenderer.invoke("vault:selectModelFiles"),
  selectRegistryFiles: () => ipcRenderer.invoke("vault:selectRegistryFiles"),
  saveAudioRecording: (input: { data: ArrayBuffer; mimeType?: string }) => ipcRenderer.invoke("vault:saveAudioRecording", input),
  saveTextFile: (input: { filename: string; contents: string; mimeType?: string }) => ipcRenderer.invoke("vault:saveTextFile", input),
  onQuickNote: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("vault:quickNote", listener);
    return () => ipcRenderer.removeListener("vault:quickNote", listener);
  },
  onAddSource: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("vault:addSource", listener);
    return () => ipcRenderer.removeListener("vault:addSource", listener);
  },
  onFocusSearch: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("vault:focusSearch", listener);
    return () => ipcRenderer.removeListener("vault:focusSearch", listener);
  }
});
