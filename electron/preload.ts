import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getConnectionStatus: () => ipcRenderer.invoke("sidecar:getConnectionStatus"),
  scanNfc: () => ipcRenderer.invoke("sidecar:scanNfc"),
  login: (credentials: { user: string; pass: string }) => ipcRenderer.invoke("sidecar:login", credentials),
});
