import cloudbase from "@cloudbase/js-sdk";

const cloudbaseConfig = {
  env: import.meta.env.VITE_CLOUDBASE_ENV_ID,
  region: import.meta.env.VITE_CLOUDBASE_REGION || "ap-shanghai",
  timeout: 8000
};

export const remoteReady = Boolean(cloudbaseConfig.env);

const app = remoteReady ? cloudbase.init(cloudbaseConfig) : null;
const auth = app ? app.auth() : null;
export const db = app ? app.database() : null;

export async function ensureRemoteSession() {
  if (!auth) return null;
  const currentState = await auth.hasLoginState?.();
  if (currentState) return currentState;
  const result = await auth.signInAnonymously();
  if (result?.error) throw result.error;
  return result?.data || auth.getLoginState?.() || null;
}

export function remoteNow() {
  return Date.now();
}
