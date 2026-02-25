import { app, BrowserWindow, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

type SidecarRequest = {
  id: string;
  type: "SET_PID" | "SCAN_NFC" | "LOGIN";
  payload?: Record<string, unknown>;
};

type SidecarResponse = {
  id: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

let mainWindow: BrowserWindow | null = null;
let goProcess: ChildProcessWithoutNullStreams | null = null;
let handshakeMessage = "Handshake not started";
let handshakeOk = false;
const pending = new Map<
  string,
  {
    resolve: (value: SidecarResponse) => void;
    reject: (reason?: unknown) => void;
    timer: NodeJS.Timeout;
  }
>();

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function resolveSidecarPath() {
  const archSuffix = process.arch === "arm64" ? "arm64" : "x64";
  const binaryName = `sidecar-darwin-${archSuffix}`;

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", binaryName);
  }

  return path.join(__dirname, "..", "backend", "bin", binaryName);
}

function startGoSidecar() {
  if (goProcess) return;
  const executablePath = resolveSidecarPath();
  goProcess = spawn(executablePath, [], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutReader = readline.createInterface({ input: goProcess.stdout });
  stdoutReader.on("line", (line) => {
    let response: SidecarResponse;
    try {
      response = JSON.parse(line) as SidecarResponse;
    } catch {
      return;
    }

    const entry = pending.get(response.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(response.id);
    entry.resolve(response);
  });

  goProcess.stderr.on("data", (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) {
      console.error(`[go-sidecar] ${msg}`);
    }
  });

  goProcess.on("exit", () => {
    goProcess = null;
    handshakeOk = false;
    handshakeMessage = "Sidecar exited";
    for (const [id, entry] of pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Go sidecar exited before response"));
      pending.delete(id);
    }
  });
}

function stopGoSidecar() {
  if (!goProcess) return;
  goProcess.kill("SIGTERM");
  goProcess = null;
}

async function sendRequest(
  type: SidecarRequest["type"],
  payload?: Record<string, unknown>,
): Promise<SidecarResponse> {
  if (!goProcess?.stdin.writable) {
    throw new Error("Go sidecar is not running");
  }

  const id = randomUUID();
  const request: SidecarRequest = { id, type, payload };
  const line = JSON.stringify(request) + "\n";

  return new Promise<SidecarResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Request timeout for ${type}`));
    }, 5000);
    pending.set(id, { resolve, reject, timer });

    goProcess!.stdin.write(line, (err) => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  });
}

async function doHandshake() {
  try {
    const response = await sendRequest("SET_PID", { pid: process.pid });
    if (response.ok) {
      handshakeOk = true;
      handshakeMessage = String(response.data?.message ?? "Handshake Successful");
    } else {
      handshakeOk = false;
      handshakeMessage = response.error ?? "Handshake failed";
    }
  } catch (err: unknown) {
    handshakeOk = false;
    handshakeMessage = err instanceof Error ? err.message : "Handshake failed";
  }
}

app.whenReady().then(async () => {
  startGoSidecar();
  await doHandshake();
  createWindow();

  ipcMain.handle("sidecar:getConnectionStatus", () => ({
    ok: handshakeOk,
    message: handshakeMessage,
    error: handshakeOk ? undefined : handshakeMessage,
  }));

  ipcMain.handle("sidecar:scanNfc", async () => {
    const response = await sendRequest("SCAN_NFC");
    if (!response.ok) throw new Error(response.error ?? "Failed to scan NFC");
    return { id: String(response.data?.id ?? "") };
  });

  ipcMain.handle("sidecar:login", async (_event, payload: { user: string; pass: string }) => {
    const response = await sendRequest("LOGIN", payload);
    if (!response.ok) throw new Error(response.error ?? "Login failed");
    return { token: String(response.data?.token ?? "") };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopGoSidecar();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
