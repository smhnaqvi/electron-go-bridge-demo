import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";

type ConnectionState = "checking" | "connected" | "disconnected";

const hasElectronAPI = typeof window !== "undefined" && Boolean(window.electronAPI);

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const [connectionMessage, setConnectionMessage] = useState("Starting handshake...");
  const [nfcId, setNfcId] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!hasElectronAPI) {
      setConnectionState("disconnected");
      setConnectionMessage("Electron preload API not detected.");
      return;
    }

    let active = true;

    void window.electronAPI
      .getConnectionStatus()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setConnectionState("connected");
          setConnectionMessage(result.message ?? "Handshake Successful");
        } else {
          setConnectionState("disconnected");
          setConnectionMessage(result.error ?? "Handshake failed");
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setConnectionState("disconnected");
        setConnectionMessage(message);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusClass = useMemo(() => {
    if (connectionState === "connected") return "status-chip connected";
    if (connectionState === "disconnected") return "status-chip disconnected";
    return "status-chip checking";
  }, [connectionState]);

  const handleScan = () => {
    if (!hasElectronAPI) return;
    setError("");
    startTransition(() => {
      void window.electronAPI
        .scanNfc()
        .then((result) => setNfcId(result.id))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Failed to scan NFC";
          setError(message);
        });
    });
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasElectronAPI) return;
    setError("");
    startTransition(() => {
      void window.electronAPI
        .login({ user, pass })
        .then((result) => setToken(result.token))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Login failed";
          setError(message);
        });
    });
  };

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Electron + Go Sidecar</h1>
        <p className="subtle">React 19 + Vite + TypeScript + Electron + Go</p>
        <div className="row">
          <span>Connection Status</span>
          <span className={statusClass}>{connectionMessage}</span>
        </div>
      </section>

      <section className="card">
        <h2>NFC Scanner</h2>
        <button type="button" onClick={handleScan} disabled={isPending || connectionState !== "connected"}>
          {isPending ? "Scanning..." : "Scan NFC"}
        </button>
        <p className="mono">ID: {nfcId || "—"}</p>
      </section>

      <section className="card">
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="form">
          <label>
            User
            <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="demo" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={pass}
              onChange={(event) => setPass(event.target.value)}
              placeholder="******"
            />
          </label>
          <button type="submit" disabled={isPending || connectionState !== "connected"}>
            {isPending ? "Submitting..." : "Login"}
          </button>
        </form>
        <p className="mono">Token: {token || "—"}</p>
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
