export type ConnectionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export type ScanResult = {
  id: string;
};

export type LoginResult = {
  token: string;
};

export interface ElectronAPI {
  getConnectionStatus: () => Promise<ConnectionResult>;
  scanNfc: () => Promise<ScanResult>;
  login: (credentials: { user: string; pass: string }) => Promise<LoginResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
