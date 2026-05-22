import { useEffect, useState } from "react";
import FillPage from "./pages/FillPage.jsx";
import DailyDataPage from "./pages/DailyDataPage.jsx";
import MonthlyPage from "./pages/MonthlyPage.jsx";
import ManagePage from "./pages/ManagePage.jsx";
import { initialEmployees, initialRecords } from "./config/data.js";
import { firebaseReady, ensureAnonymousSession } from "./services/firebase.js";
import {
  addRecord,
  removeEmployee,
  removeRecordsByEmployeeDate,
  saveEmployee,
  seedInitialData,
  subscribeData
} from "./services/dataService.js";
import { useAdminSession } from "./hooks/useAdminSession.js";

export default function App() {
  const [data, setData] = useState({ employees: initialEmployees, records: initialRecords() });
  const [page, setPage] = useState("fill");
  const [error, setError] = useState("");
  const { adminUnlocked, setAdminUnlocked } = useAdminSession();

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;

    async function connect() {
      try {
        if (firebaseReady) await ensureAnonymousSession();
        if (!cancelled) unsubscribe = subscribeData(setData, (err) => setError(err.message));
      } catch (err) {
        setError(err.message);
        unsubscribe = subscribeData(setData, (fallbackErr) => setError(fallbackErr.message));
      }
    }

    connect();
    return () => {
      cancelled = true;
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
      </header>
      {error && <div className="error banner">{error}</div>}
      <main className="content">
        {page === "fill" && <FillPage employees={employees} records={records} onAddRecord={addRecord} onClearRecordsByDate={removeRecordsByEmployeeDate} adminUnlocked={adminUnlocked} />}
        {page === "daily" && <DailyDataPage employees={employees} records={records} />}
        {page === "monthly" && <MonthlyPage employees={employees} records={records} />}
        {page === "manage" && <ManagePage employees={employees} onSaveEmployee={saveEmployee} onRemoveEmployee={removeEmployee} onSeed={seedInitialData} adminUnlocked={adminUnlocked} onAdminUnlockedChange={setAdminUnlocked} />}
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
