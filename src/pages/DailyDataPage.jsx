import { useEffect, useState } from "react";
import { indicatorLabels, indicatorUnits } from "../config/data.js";
import { computeMonthlyStats, formatNumber, summarizeDay, todayString, withRewardPoints } from "../utils/metrics.js";

function EmployeeStatusDetail({ employee, records, selectedDate, onClose }) {
  const [mode, setMode] = useState("daily");
  const selectedMonth = selectedDate.slice(0, 7);
  const dailyRecords = records.filter((record) => record.employeeId === employee.id && record.date === selectedDate);
  const monthlyStat = withRewardPoints(computeMonthlyStats(records, [employee], selectedMonth))[0];
  const indicatorRows = monthlyStat ? Object.keys(monthlyStat.rates).map((key) => ({ key, label: indicatorLabels[key], target: employee.targets?.[key] || 0 })) : [];
  const filledDays = new Set(records.filter((record) => record.employeeId === employee.id && record.date?.startsWith(selectedMonth)).map((record) => record.date)).size;

  return (
    <section className="panel personal-summary">
      <div className="panel-title">
        <div>
          <p className="eyebrow">个人信息</p>
          <h2>{employee.name} · {employee.group}</h2>
        </div>
        <div className="personal-actions">
          <div className="view-tabs compact-tabs">
            <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}>日报</button>
            <button className={mode === "monthly" ? "active" : ""} onClick={() => setMode("monthly")}>月报</button>
          </div>
          {onClose && <button className="close-button" onClick={onClose} aria-label="关闭个人信息">×</button>}
        </div>
      </div>
      {mode === "daily" ? (
        <div className="contrib-list">
          {dailyRecords.length ? dailyRecords.map((record) => (
            <div className="contrib-row" key={record.id}>
              <strong>{indicatorLabels[record.indicator]}</strong>
              <span>+{formatNumber(record.value)}{indicatorUnits[record.indicator]}</span>
            </div>
          )) : <div className="empty">{selectedDate} 还没有填报。</div>}
        </div>
      ) : (
        <div className="rush-panel">
          <div className="rush-summary">
            <span>本月填报 {filledDays} 天</span>
            <strong>综合 {formatNumber((monthlyStat?.overall || 0) * 100)}%</strong>
          </div>
          {indicatorRows.map((row) => {
            const actual = monthlyStat?.actuals[row.key] || 0;
            const rate = row.target ? Math.min(actual / row.target, 1.5) : 0;
            const remain = row.target - actual;
            const remainText = remain > 0
              ? `还差 ${formatNumber(remain)} ${indicatorUnits[row.key]}`
              : remain < 0
                ? `超额 ${formatNumber(Math.abs(remain))} ${indicatorUnits[row.key]}`
                : "已完成";
            return (
              <div className="rush-item" key={row.key}>
                <div className="rush-label">
                  <span>{row.label}</span>
                  <strong>{formatNumber(actual)} / {formatNumber(row.target)} {indicatorUnits[row.key]}</strong>
                </div>
                <div className="rush-track">
                  <div className={actual >= row.target ? "over" : ""} style={{ width: `${Math.min(rate * 100, 100)}%` }} />
                </div>
                <div className="rush-remain">{remainText}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DailyDashboard({ employees, records, selectedDate, setSelectedDate }) {
  const summary = summarizeDay(records, employees, selectedDate);

  return (
    <div className="dashboard-grid">
      <section className="panel table-panel">
        <div className="dashboard-title">
          <input className="date-compact" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <p className="eyebrow">日报视图</p>
          <h2>{selectedDate} 业绩汇总</h2>
        </div>
        <div className="metric-grid">
          {Object.entries(indicatorLabels).slice(0, 6).map(([key, label]) => (
            <div className="metric-card" key={key}>
              <span>{label}</span>
              <strong>{formatNumber(summary.byIndicator[key] || 0)}</strong>
              <small>{indicatorUnits[key]}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
}

function downloadDailyDetail(employees, records, selectedDate) {
  const metricKeys = ["validAccount", "newAsset", "investSign", "twoMarginValid", "productSales", "twoMarginNew", "extraT0"];
  const headers = ["日期", "组别", "姓名", "填报状态", ...metricKeys.map((key) => `${indicatorLabels[key]}(${indicatorUnits[key]})`), "备注"];
  const dayRecords = records.filter((record) => record.date === selectedDate);
  const rows = employees.map((employee) => {
    const employeeRecords = dayRecords.filter((record) => record.employeeId === employee.id);
    const values = metricKeys.reduce((acc, key) => {
      acc[key] = employeeRecords.filter((record) => record.indicator === key).reduce((sum, record) => sum + Number(record.value || 0), 0);
      return acc;
    }, {});
    const notes = [...new Set(employeeRecords.map((record) => record.note).filter(Boolean))].join("；");

    return [selectedDate, employee.group, employee.name, employeeRecords.length ? "已填报" : "未填报", ...metricKeys.map((key) => formatNumber(values[key] || 0)), notes];
  });

  return downloadCsv(`${selectedDate}-今日填报汇总.csv`, headers, rows);
}

export default function DailyDataPage({ employees, records }) {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [selectedStatusEmployeeId, setSelectedStatusEmployeeId] = useState(employees[0]?.id || "");
  const [downloadInfo, setDownloadInfo] = useState(null);
  const day = summarizeDay(records, employees, selectedDate);
  const selectedStatusEmployee = employees.find((employee) => employee.id === selectedStatusEmployeeId);

  useEffect(() => {
    if (!employees.some((employee) => employee.id === selectedStatusEmployeeId)) {
      setSelectedStatusEmployeeId(employees[0]?.id || "");
    }
  }, [employees, selectedStatusEmployeeId]);

  useEffect(() => () => {
    if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
  }, [downloadInfo]);

  return (
    <div className="daily-data-page">
      <DailyDashboard employees={employees} records={records} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      <section className="panel table-panel">
        <div className="panel-title">
          <div>
            <h2>今日填报状态</h2>
          </div>
          <div className="panel-actions">
            <strong>{day.filledEmployeeIds.size}/{employees.length}</strong>
            <button
              className="ghost"
              onClick={() => {
                if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
                setDownloadInfo(downloadDailyDetail(employees, records, selectedDate));
              }}
            >
              下载表格
            </button>
          </div>
        </div>
        {downloadInfo && (
          <a className="export-link" href={downloadInfo.url} download={downloadInfo.filename} target="_blank" rel="noreferrer">
            表格已生成，点击打开
          </a>
        )}
        <div className="status-grid">
          {employees.map((employee) => (
            <button className={`status-pill status-button ${selectedStatusEmployeeId === employee.id ? "selected" : ""}`} key={employee.id} onClick={() => setSelectedStatusEmployeeId(employee.id)}>
              <span className={day.filledEmployeeIds.has(employee.id) ? "dot ok" : "dot miss"} />
              <div>
                <strong>{employee.name}</strong>
                <small>{employee.group}</small>
              </div>
            </button>
          ))}
        </div>
        {selectedStatusEmployee && <EmployeeStatusDetail employee={selectedStatusEmployee} records={records} selectedDate={selectedDate} />}
      </section>
    </div>
  );
}
