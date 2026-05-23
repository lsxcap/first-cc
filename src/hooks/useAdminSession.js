import { useEffect, useState } from "react";
import { ADMIN_ACTIVE_AT_KEY, ADMIN_SESSION_KEY, ADMIN_TIMEOUT_MS, APP_ROLES } from "../config/constants.js";

function readAdminSession() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_ACTIVE_AT_KEY);
  } catch {
    // ignore
  }
  return { role: APP_ROLES.USER, lastActiveAt: 0 };
}

function writeAdminSession(isAdmin) {
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, isAdmin ? "1" : "0");
    if (isAdmin) localStorage.setItem(ADMIN_ACTIVE_AT_KEY, String(Date.now()));
    else localStorage.removeItem(ADMIN_ACTIVE_AT_KEY);
  } catch {
    // ignore
  }
}

export function useAdminSession() {
  const initialSession = readAdminSession();
  const [role, setRole] = useState(initialSession.role);
  const [adminLoginTime, setAdminLoginTime] = useState(initialSession.lastActiveAt || 0);

  const isAdmin = role === APP_ROLES.ADMIN;

  useEffect(() => {
    writeAdminSession(isAdmin);
    if (isAdmin) setAdminLoginTime(Date.now());
    else setAdminLoginTime(0);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const markActive = () => writeAdminSession(true);
    const events = ["click", "keydown", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));

    const timer = window.setInterval(() => {
      try {
        const lastActiveAt = Number(localStorage.getItem(ADMIN_ACTIVE_AT_KEY) || 0);
        if (!lastActiveAt || Date.now() - lastActiveAt >= ADMIN_TIMEOUT_MS) {
          setRole(APP_ROLES.USER);
        }
      } catch {
        setRole(APP_ROLES.USER);
      }
    }, 30 * 1000);

    return () => {
      window.clearInterval(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
    };
  }, [isAdmin]);

  function setIsAdmin(nextIsAdmin) {
    setRole(nextIsAdmin ? APP_ROLES.ADMIN : APP_ROLES.USER);
  }

  function exitAdminMode() {
    setRole(APP_ROLES.USER);
    writeAdminSession(false);
  }

  function refreshAdminActivity() {
    if (!isAdmin) return;
    writeAdminSession(true);
    setAdminLoginTime(Date.now());
  }

  return {
    role,
    isAdmin,
    adminLoginTime,
    setIsAdmin,
    exitAdminMode,
    refreshAdminActivity
  };
}
