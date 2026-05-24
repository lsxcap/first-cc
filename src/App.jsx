import { useEffect, useState } from "react";
import FillPage from "./pages/FillPage.jsx";
import DailyDataPage from "./pages/DailyDataPage.jsx";
import MonthlyPage from "./pages/MonthlyPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import { initialEmployees, initialRecords } from "./config/data.js";
import { ensureAnonymousSession, firebaseReady } from "./services/firebase.js";
import {
  addRecord,
  initializeProductionData,
  removeEmployee,
  removeRecordsByEmployeeDate,
  saveEmployee,
  subscribeLocalData,
  subscribeData,
  syncPendingRecords,
  updateRecord
} from "./services/dataService.js";
import { useAdminSession } from "./hooks/useAdminSession.js";

function AdminBadge({ adminUnlocked, adminLoginTime, onExit }) {
  if (!adminUnlocked) return null;
  const timeText = adminLoginTime ? new Date(adminLoginTime).toLocaleString("zh-CN", { hour12: false }) : "刚刚";

  return (
    <div className="admin-badge">
      <div className="admin-badge-text">
        <span>🛠 管理员模式</span>
        <small>已登录：{timeText}</small>
      </div>
      <button type="button" className="ghost" onClick={onExit}>退出管理员模式</button>
    </div>
  );
}

function withTimeout(promise, timeoutMs, message = "远程服务连接超时") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

export default function App() {
  const [data, setData] = useState({ employees: initialEmployees, records: initialRecords() });
  const [page, setPage] = useState("fill");
  const [error, setError] = useState("");
  const { isAdmin, adminLoginTime, setIsAdmin, exitAdminMode } = useAdminSession();

  useEffect(() => {
    let unsubscribe = () => {};
    let retryTimer = null;
    let cancelled = false;

    async function connect() {
      try {
        if (firebaseReady) await withTimeout(ensureAnonymousSession(), 6000, "远程登录超时，已启用本地暂存");
        if (!cancelled) unsubscribe = subscribeData(setData, (err) => setError(err.message));
      } catch (err) {
        if (cancelled) return;
        setError(`${err.message}。当前提交会先暂存，网络恢复后自动补传。`);
        unsubscribe = subscribeLocalData(setData);
        retryTimer = window.setInterval(async () => {
          try {
            if (firebaseReady) await withTimeout(ensureAnonymousSession(), 6000);
            await syncPendingRecords();
            if (cancelled) return;
            unsubscribe();
            unsubscribe = subscribeData(setData, (fallbackErr) => setError(fallbackErr.message));
            setError("");
            window.clearInterval(retryTimer);
          } catch {
            // Keep local queue active until the remote service is reachable.
          }
        }, 15000);
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearInterval(retryTimer);
      unsubscribe();
    };
  }, []);

  const employees = data.employees.length ? data.employees : [];
  const records = data.records;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">刘娟的工作台</p>
        </div>
        <AdminBadge adminUnlocked={isAdmin} adminLoginTime={adminLoginTime} onExit={exitAdminMode} />
      </header>
      {error && <div className="error banner">{error}</div>}
      <main className="content">
        {page === "fill" && <FillPage employees={employees} records={records} onAddRecord={addRecord} adminUnlocked={isAdmin} />}
        {page === "daily" && <DailyDataPage employees={employees} records={records} isAdmin={isAdmin} onSetAdmin={setIsAdmin} onUpdateRecord={updateRecord} onRemoveRecordsByEmployeeDate={removeRecordsByEmployeeDate} />}
        {page === "monthly" && <MonthlyPage employees={employees} records={records} isAdmin={isAdmin} onSetAdmin={setIsAdmin} />}
        {page === "manage" && <ManagePage employees={employees} onSaveEmployee={saveEmployee} onRemoveEmployee={removeEmployee} onInitializeProductionData={initializeProductionData} isAdmin={isAdmin} onSetAdmin={setIsAdmin} onExitAdminMode={exitAdminMode} />}
      </main>
      <nav className="bottom-nav">
        <button className={page === "fill" ? "active" : ""} onClick={() => setPage("fill")}><span>填</span>今日填报</button>
        <button className={page === "daily" ? "active" : ""} onClick={() => setPage("daily")}><span>日</span>每日数据</button>
        <button className={page === "monthly" ? "active" : ""} onClick={() => setPage("monthly")}><span>月</span>月度看板</button>
        <button className={page === "manage" ? "active" : ""} onClick={() => setPage("manage")}><span>管</span>员工管理</button>
      </nav>
    </div>
  );
}
