import { useEffect, useState } from "react";
import { ADMIN_ACTIVE_AT_KEY, ADMIN_SESSION_KEY, ADMIN_TIMEOUT_MS } from "../config/constants.js";

export function useAdminSession() {
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    try {
      const unlocked = localStorage.getItem(ADMIN_SESSION_KEY) === "1";
      const lastActiveAt = Number(localStorage.getItem(ADMIN_ACTIVE_AT_KEY) || 0);
      return unlocked && Date.now() - lastActiveAt < ADMIN_TIMEOUT_MS;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SESSION_KEY, adminUnlocked ? "1" : "0");
      if (adminUnlocked) localStorage.setItem(ADMIN_ACTIVE_AT_KEY, String(Date.now()));
      else localStorage.removeItem(ADMIN_ACTIVE_AT_KEY);
    } catch {
      // ignore
    }
  }, [adminUnlocked]);

  return { adminUnlocked, setAdminUnlocked };
}
