import { useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import { ensureAnonymousSession, firebaseReady } from "./firebase.js";
import { addRecord, removeEmployee, saveEmployee, seedInitialData, subscribeData } from "./services.js";
import { indicatorLabels, indicatorUnits, initialEmployees, initialRecords, monthlyRules } from "./data.js";
import {
  computeMonthlyStats,
  formatNumber,
  indicatorRowsFor,
  monthString,
  summarizeDay,
  todayString,
  withRewardPoints
} from "./metrics.js";

const adminCode = import.meta.env.VITE_ADMIN_ACCESS_CODE || "123456";

function EmployeeStatusDetail({ employee, records, selectedDate, onClose }) {
  const [mode, setMode] = useState("monthly");
  const selectedMonth = selectedDate.slice(0, 7);
  const dailyRecords = records.filter((record) => record.employeeId === employee.id && record.date === selectedDate);
  const monthlyStat = withRewardPoints(computeMonthlyStats(records, [employee], selectedMonth))[0];
  const indicatorRows = indicatorRowsFor(employee);
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
                  <div
                    className={actual >= row.target ? "over" : ""}
                    style={{ width: `${Math.min(rate * 100, 100)}%` }}
                  />
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

function OptionPicker({ options, value, onChange, placeholder = "请选择" }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div className="picker">
      <button type="button" className={`picker-trigger ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label || placeholder}</span>
        <b />
      </button>
      {open && (
        <div className="picker-menu">
          {options.map((option) => (
            <button
              type="button"
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <strong>{option.label}</strong>
              {option.meta && <span>{option.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeePicker({ employees, value, onChange }) {
  return (
    <OptionPicker
      options={employees.map((employee) => ({ value: employee.id, label: employee.name, meta: employee.group }))}
      value={value}
      onChange={onChange}
      placeholder="选择员工"
    />
  );
}

function ProductTypePicker({ value, onChange }) {
  return (
    <OptionPicker
      options={[
        { value: "private", label: "私募", meta: "1.5倍" },
        { value: "public", label: "公募", meta: "1倍" },
        { value: "warrant", label: "收凭", meta: "0.8倍" }
      ]}
      value={value}
      onChange={onChange}
      placeholder="选择产品类型"
    />
  );
}

function AssessmentOverview() {
  const metricCards = [
    ["两融有效户", "权重25%", "上限150%", 85, 25, "green"],
    ["有效户", "权重20%", "上限100%", 100, 20, "blue"],
    ["新增资产", "权重20%", "上限150%", 50, 20, "blue"],
    ["产品销售额", "权重20%", "上限150%", 60, 20, "blue"],
    ["投顾签约", "权重15%", "上限150%", 30, 15, "blue"],
    ["新开两融", "权重10%", "上限100%", 70, 10, "blue"]
  ];

  return (
    <section className="panel assessment-panel">
      <div className="assessment-header">
        <div>
          <p className="eyebrow">考核机制速览</p>
          <h2>六大核心指标与加分规则</h2>
        </div>
        <span>5月机制</span>
      </div>
      <div className="assessment-grid">
        <div className="assessment-card">
          <h3>核心考核大盘</h3>
          <div className="assessment-metrics">
            {metricCards.map(([name, weight, limit, width, weightPoint, tone]) => (
              <div className="assessment-metric" key={name}>
                <div>
                  <strong>{name}</strong>
                  <span>{weight} · {limit}</span>
                </div>
                <div className="assessment-track">
                  <i style={{ left: `${weightPoint}%` }} />
                  <div className={tone === "green" ? "green" : ""} style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="assessment-side">
          <div className="assessment-card">
            <h3>产品销售额换算</h3>
            <div className="factor-list">
              <div className="factor-row buff"><strong>私募及重点公募</strong><span>×1.5</span></div>
              <div className="factor-row"><strong>其余公募</strong><span>×1.0</span></div>
              <div className="factor-row debuff"><strong>收凭</strong><span>×0.8</span></div>
            </div>
            <p className="rule-note">有效户折算：开立10个空户视同1个有效户，上限+2户。</p>
          </div>
          <div className="assessment-card">
            <h3>附加任务与雷区</h3>
            <div className="action-list">
              <div className="action-row reward"><strong>T0新开一户</strong><span>+5分</span></div>
              <div className="action-row reward"><strong>产生300万成交量</strong><span>+5分</span></div>
              <div className="action-row bonus"><strong>组内首位且≥80%</strong><span>+2分</span></div>
              <div className="action-row penalty"><strong>组内末位且&lt;50%</strong><span>-2分</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FillPage({ employees, onAddRecord }) {
  const today = todayString();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [date, setDate] = useState(today);
  const [productType, setProductType] = useState("private");
  const [values, setValues] = useState({});
  const [emptyCount, setEmptyCount] = useState("");
  const [note, setNote] = useState("");
  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const fillRows = selectedEmployee ? indicatorRowsFor(selectedEmployee) : [];
  const marginKey = selectedEmployee?.group === "新人组" ? "twoMarginNew" : "twoMarginValid";
  const orderedRows = ["newAsset", "investSign", "validAccount", "productSales", marginKey]
    .map((key) => fillRows.find((row) => row.key === key))
    .filter(Boolean);
  const rowByKey = Object.fromEntries(fillRows.map((row) => [row.key, row]));

  useEffect(() => {
    if (!employeeId && employees[0]?.id) setEmployeeId(employees[0].id);
  }, [employeeId, employees]);

  async function submit(event) {
    event.preventDefault();
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const created = [];

    for (const row of fillRows) {
      const rawValue = Number(values[row.key] || 0);
      if (!rawValue) continue;
      let finalValue = rawValue;
      let detail = note;

      if (row.key === "validAccount") {
        const bonus = Math.min(Math.floor(Number(emptyCount || 0) / 10), 2);
        finalValue += bonus;
        if (bonus) detail = `${detail ? `${detail}；` : ""}空户折算+${bonus}`;
      }
      if (row.key === "productSales") {
        const coeff = { private: 1.5, public: 1, warrant: 0.8 }[productType] || 1;
        finalValue *= coeff;
        detail = `${detail ? `${detail}；` : ""}产品系数${coeff}`;
      }

      created.push(onAddRecord({
        employeeId,
        employeeName: employee.name,
        date,
        indicator: row.key,
        value: finalValue,
        rawValue,
        extraPoints: 0,
        note: detail
      }));
    }

    const extraPoints = Number(values.extraT0 || 0);
    if (extraPoints) {
      created.push(onAddRecord({
        employeeId,
        employeeName: employee.name,
        date,
        indicator: "extraT0",
        value: extraPoints,
        rawValue: extraPoints,
        extraPoints,
        note
      }));
    }

    if (!created.length) return;
    await Promise.all(created);
    setValues({});
    setEmptyCount("");
    setNote("");
  }

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function MetricInput({ metricKey, placeholder = "0" }) {
    if (!rowByKey[metricKey]) return null;
    return (
      <label className="form-field">
        {rowByKey[metricKey].label}
        <div className="input-unit">
          <input
            type="number"
            step="any"
            value={values[metricKey] || ""}
            onChange={(event) => updateValue(metricKey, event.target.value)}
            placeholder={placeholder}
          />
          <span>{indicatorUnits[metricKey]}</span>
        </div>
      </label>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel fill-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">今日填报</p>
            <h2>新增业绩记录</h2>
          </div>
        </div>
        <form className="work-form" onSubmit={submit}>
          <section className="form-section">
            <div className="form-section-title">基本信息</div>
            <div className="performance-grid">
              <label className="form-field">
                员工姓名
                <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} />
              </label>
              <label className="form-field">
                记录日期
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">核心业绩指标</div>
            <div className="performance-grid">
              <MetricInput metricKey="newAsset" />
              <MetricInput metricKey="investSign" />
              {rowByKey.validAccount && (
                <label className="form-field">
                  有效户 / 空户数
                  <div className="compound-row">
                    <div className="input-unit">
                      <input
                        type="number"
                        step="any"
                        value={values.validAccount || ""}
                        onChange={(event) => updateValue("validAccount", event.target.value)}
                        placeholder="有效户"
                      />
                      <span>户</span>
                    </div>
                    <div className="input-unit">
                      <input
                        type="number"
                        min="0"
                        value={emptyCount}
                        onChange={(event) => setEmptyCount(event.target.value)}
                        placeholder="空户数"
                      />
                      <span>户</span>
                    </div>
                  </div>
                </label>
              )}
              {rowByKey.productSales && (
                <label className="form-field">
                  产品销售额
                  <div className="compound-row product-compound">
                    <div className="input-unit">
                      <input
                        type="number"
                        step="any"
                        value={values.productSales || ""}
                        onChange={(event) => updateValue("productSales", event.target.value)}
                        placeholder="金额"
                      />
                      <span>万元</span>
                    </div>
                    <ProductTypePicker value={productType} onChange={setProductType} />
                  </div>
                </label>
              )}
              <MetricInput metricKey={marginKey} />
              <label className="form-field">
                额外加分
                <div className="input-unit">
                  <input
                    type="number"
                    step="any"
                    value={values.extraT0 || ""}
                    onChange={(event) => updateValue("extraT0", event.target.value)}
                    placeholder="0"
                  />
                  <span>分</span>
                </div>
              </label>
            </div>
          </section>

          <section className="form-section">
            <label className="form-field full-width">
              备注信息
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="请输入来源、客户详情或修正说明..." />
            </label>
          </section>

          <button className="primary submit-wide">提交业绩记录</button>
        </form>
      </section>

      <AssessmentOverview />
    </div>
  );
}

function FillStatusPanel({ employees, records, selectedDate }) {
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
  );
}

function Chart({ option }) {
  const id = useMemo(() => `chart-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    const element = document.getElementById(id);
    if (!element) return undefined;
    const chart = echarts.init(element);
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [id, option]);

  return <div id={id} className="chart" />;
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
      acc[key] = employeeRecords
        .filter((record) => record.indicator === key)
        .reduce((sum, record) => sum + Number(record.value || 0), 0);
      return acc;
    }, {});
    const notes = [...new Set(employeeRecords.map((record) => record.note).filter(Boolean))].join("；");

    return [
      selectedDate,
      employee.group,
      employee.name,
      employeeRecords.length ? "已填报" : "未填报",
      ...metricKeys.map((key) => formatNumber(values[key] || 0)),
      notes
    ];
  });

  return downloadCsv(`${selectedDate}-今日填报汇总.csv`, headers, rows);
}

function downloadMonthlyDetail(stats, selectedMonth) {
  const groups = ["老人组", "新人组"];
  const headers = ["组别", "姓名", "综合", "有效户目标", "有效户实际", "有效户完成率", "新增资产目标", "新增资产实际", "新增资产完成率", "投顾目标", "投顾实际", "投顾完成率", "两融/新开目标", "两融/新开实际", "两融/新开完成率", "产品目标", "产品实际", "产品完成率", "奖惩分"];
  const metricKeysFor = (group) => ["validAccount", "newAsset", "investSign", group === "新人组" ? "twoMarginNew" : "twoMarginValid", "productSales"];
  const formatRate = (rate) => `${formatNumber((rate || 0) * 100)}%`;
  const formatPoints = (points) => points > 0 ? `+${formatNumber(points)}` : formatNumber(points);
  const rows = groups.flatMap((group) => {
    const groupRows = stats.filter((item) => item.employee.group === group);
    const metricKeys = metricKeysFor(group);
    const detailRows = groupRows.map((item) => [
      group,
      item.employee.name,
      formatRate(item.overall),
      ...metricKeys.flatMap((key) => [
        formatNumber(item.employee.targets[key]),
        formatNumber(item.actuals[key]),
        formatRate(item.rates[key])
      ]),
      formatPoints(item.finalPoints)
    ]);
    if (!groupRows.length) return detailRows;

    const totals = metricKeys.map((key) => {
      const target = groupRows.reduce((sum, item) => sum + Number(item.employee.targets[key] || 0), 0);
      const actual = groupRows.reduce((sum, item) => sum + Number(item.actuals[key] || 0), 0);
      return [formatNumber(target), formatNumber(actual), formatRate(target > 0 ? actual / target : 0)];
    });
    const averageOverall = groupRows.reduce((sum, item) => sum + item.overall, 0) / groupRows.length;
    const totalPoints = groupRows.reduce((sum, item) => sum + Number(item.finalPoints || 0), 0);

    return [
      ...detailRows,
      [
        group,
        "合计",
        formatRate(averageOverall),
        ...totals.flat(),
        formatPoints(totalPoints)
      ]
    ];
  });
  return downloadCsv(`${selectedMonth}-个人明细.csv`, headers, rows);
}

function MonthlyRulePanel() {
  return (
    <details className="panel rules-panel">
      <summary>月度规则归纳</summary>
      <div className="rule-grid">
        {monthlyRules.map((rule, index) => (
          <div className="rule-card" key={rule}>
            <span>{index + 1}</span>
            <p>{rule}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function DetailGroupTable({ group, stats }) {
  const rows = stats.filter((item) => item.employee.group === group);
  const marginKey = group === "新人组" ? "twoMarginNew" : "twoMarginValid";
  const columns = ["validAccount", "newAsset", "investSign", marginKey, "productSales"];
  const totals = columns.reduce((acc, key) => {
    const target = rows.reduce((sum, item) => sum + Number(item.employee.targets[key] || 0), 0);
    const actual = rows.reduce((sum, item) => sum + Number(item.actuals[key] || 0), 0);
    acc[key] = {
      target,
      actual,
      rate: target > 0 ? actual / target : 0
    };
    return acc;
  }, {});
  const averageOverall = rows.reduce((sum, item) => sum + item.overall, 0) / Math.max(1, rows.length);
  const totalPoints = rows.reduce((sum, item) => sum + Number(item.finalPoints || 0), 0);
  if (!rows.length) return null;

  return (
    <section className="detail-group">
      <div className="detail-group-title">
        <strong>{group}</strong>
        <span>{rows.length}人</span>
      </div>
      <div className="table-scroll">
        <table className="score-table">
          <thead>
            <tr>
              <th rowSpan="2">姓名</th>
              <th rowSpan="2">综合</th>
              {columns.map((key) => <th colSpan="3" key={key}>{indicatorLabels[key]}</th>)}
              <th rowSpan="2">奖惩分</th>
            </tr>
            <tr>
              {columns.map((key) => (
                <FragmentHeaders key={key} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.employee.id}>
                <td>{item.employee.name}</td>
                <td><strong>{formatNumber(item.overall * 100)}%</strong></td>
                {columns.map((key) => {
                  const target = item.employee.targets[key] || 0;
                  const actual = item.actuals[key] || 0;
                  const rate = item.rates[key] || 0;
                  return (
                    <FragmentCells
                      key={key}
                      target={target}
                      actual={actual}
                      rate={rate}
                    />
                  );
                })}
                <td>{item.finalPoints > 0 ? `+${item.finalPoints}` : item.finalPoints}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>合计</td>
              <td><strong>{formatNumber(averageOverall * 100)}%</strong></td>
              {columns.map((key) => (
                <FragmentCells
                  key={key}
                  target={totals[key].target}
                  actual={totals[key].actual}
                  rate={totals[key].rate}
                />
              ))}
              <td>{totalPoints > 0 ? `+${formatNumber(totalPoints)}` : formatNumber(totalPoints)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function FragmentHeaders() {
  return (
    <>
      <th>指标</th>
      <th>实际</th>
      <th>完成率</th>
    </>
  );
}

function FragmentCells({ target, actual, rate }) {
  return (
    <>
      <td>{formatNumber(target)}</td>
      <td>{formatNumber(actual)}</td>
      <td>{formatNumber(rate * 100)}%</td>
    </>
  );
}

function PointsRaceBoard({ stats }) {
  const positiveRows = [...stats].filter((item) => item.finalPoints > 0).sort((a, b) => {
    if (b.finalPoints !== a.finalPoints) return b.finalPoints - a.finalPoints;
    return b.overall - a.overall;
  }).slice(0, 3);
  const negativeRows = [...stats].filter((item) => item.finalPoints < 0).sort((a, b) => {
    if (a.finalPoints !== b.finalPoints) return a.finalPoints - b.finalPoints;
    return a.overall - b.overall;
  }).slice(0, 3);
  const maxPositive = Math.max(1, ...positiveRows.map((item) => item.finalPoints));
  const maxNegative = Math.max(1, ...negativeRows.map((item) => Math.abs(item.finalPoints)));

  return (
    <section className="panel points-panel">
      <div className="panel-title">
        <h2>积分赛道榜</h2>
      </div>
      <div className="points-lanes">
        <PointLane title="正向积分" rows={positiveRows} maxPoint={maxPositive} tone="positive" emptyText="暂无加分记录" />
        <PointLane title="扣分提醒" rows={negativeRows} maxPoint={maxNegative} tone="negative" emptyText="暂无扣分记录" />
      </div>
      <p className="points-note">正向积分展示奖励与额外加分，扣分提醒展示组内末位等扣分项。</p>
    </section>
  );
}

function PointLane({ title, rows, maxPoint, tone, emptyText }) {
  return (
    <div className={`points-lane ${tone}`}>
      <h3>{title}</h3>
      <div className="points-list">
        {rows.length === 0 && <div className="points-empty">{emptyText}</div>}
        {rows.map((item, index) => {
          const rewardDelta = item.finalPoints - item.extraPoints;
          const absPoint = Math.abs(item.finalPoints);
          const width = `${absPoint / maxPoint * 100}%`;
          return (
            <div className="points-row" key={item.employee.id}>
              <div className={`points-medal points-${index + 1}`}>{index + 1}</div>
              <div className="points-main">
                <div className="points-line">
                  <div className="points-person">
                    <strong>{item.employee.name}</strong>
                    <span>{item.employee.group}</span>
                  </div>
                  <div className="points-score">{formatNumber(item.finalPoints)} 分</div>
                </div>
                <div className="points-badges">
                  {rewardDelta > 0 && <b className="reward">奖 +{rewardDelta}</b>}
                  {rewardDelta < 0 && <b className="penalty">罚 {rewardDelta}</b>}
                  {item.extraPoints > 0 && <b className="extra">额外 +{item.extraPoints}</b>}
                </div>
                <div className="points-track">
                  <div style={{ width }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyDashboard({ employees, records, selectedMonth, setSelectedMonth }) {
  const [downloadInfo, setDownloadInfo] = useState(null);
  const stats = withRewardPoints(computeMonthlyStats(records, employees, selectedMonth));
  const sorted = [...stats].sort((a, b) => b.overall - a.overall);
  const oldAvg = stats.filter((item) => item.employee.group === "老人组").reduce((sum, item) => sum + item.overall, 0) / Math.max(1, stats.filter((item) => item.employee.group === "老人组").length);
  const newAvg = stats.filter((item) => item.employee.group === "新人组").reduce((sum, item) => sum + item.overall, 0) / Math.max(1, stats.filter((item) => item.employee.group === "新人组").length);
  const podium = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  useEffect(() => () => {
    if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
  }, [downloadInfo]);

  return (
    <div className="dashboard-grid">
      <section className="panel monthly-overview">
        <div className="dashboard-title">
          <input className="date-compact" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          <p className="eyebrow">月报视图</p>
          <h2>{selectedMonth} 完成率</h2>
        </div>
        <div className="monthly-overview-grid">
          <div className="metric-grid two compact-average">
            <div className="metric-card accent"><span>老人组平均</span><strong>{formatNumber(oldAvg * 100)}%</strong></div>
            <div className="metric-card green"><span>新人组平均</span><strong>{formatNumber(newAvg * 100)}%</strong></div>
          </div>
          <div className="compact-rank">
            <h3>完成率排行</h3>
            <div className="podium-list compact-podium">
              {podium.map((item) => {
                const place = sorted.findIndex((stat) => stat.employee.id === item.employee.id) + 1;
                return (
                  <div className={`podium-card podium-${place}`} key={item.employee.id}>
                    <div className="rank-medal">{place}</div>
                    <div className="rank-person">
                      <strong>{item.employee.name}</strong>
                      <span>{item.employee.group}</span>
                    </div>
                    <div className="rank-score">{formatNumber(item.overall * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <PointsRaceBoard stats={stats} />
      <section className="panel table-panel">
        <div className="panel-title">
          <h2>个人明细</h2>
          <div className="panel-actions">
            {downloadInfo && (
              <a className="export-link" href={downloadInfo.url} download={downloadInfo.filename} target="_blank" rel="noreferrer">
                表格已生成，点击打开
              </a>
            )}
            <button
              className="ghost"
              onClick={() => {
                if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
                setDownloadInfo(downloadMonthlyDetail(sorted, selectedMonth));
              }}
            >
              下载表格
            </button>
          </div>
        </div>
        <div className="detail-groups">
          <DetailGroupTable group="老人组" stats={sorted} />
          <DetailGroupTable group="新人组" stats={sorted} />
        </div>
      </section>
      <MonthlyRulePanel />
    </div>
  );
}

function DailyDataPage({ employees, records }) {
  const [selectedDate, setSelectedDate] = useState(todayString());

  return (
    <div className="daily-data-page">
      <DailyDashboard employees={employees} records={records} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      <FillStatusPanel employees={employees} records={records} selectedDate={selectedDate} />
    </div>
  );
}

function MonthlyPage({ employees, records }) {
  const [selectedMonth, setSelectedMonth] = useState(monthString());

  return (
    <MonthlyDashboard employees={employees} records={records} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />
  );
}

function ManagePage({ employees, onSaveEmployee, onRemoveEmployee, onSeed }) {
  const [editing, setEditing] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const employee = editing || { id: `e${Date.now()}`, name: "", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } };
  const rows = indicatorRowsFor(employee);
  const groups = ["老人组", "新人组"].map((group) => ({
    group,
    employees: employees.filter((item) => item.group === group)
  })).filter((item) => item.employees.length);

  function unlock(event) {
    event.preventDefault();
    if (password === adminCode) {
      setUnlocked(true);
      setAuthError("");
    } else {
      setAuthError("管理员口令不正确");
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!unlocked) return;
    await onSaveEmployee(employee);
    setEditing(null);
  }

  async function guardedSeed() {
    if (!unlocked) return;
    await onSeed();
  }

  async function guardedRemove(employeeId) {
    if (!unlocked) return;
    if (confirm("确认删除这个员工？")) await onRemoveEmployee(employeeId);
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">管理区</p>
            <h2>员工与指标</h2>
          </div>
          {unlocked && <button className="ghost" onClick={guardedSeed}>初始化样例</button>}
        </div>
        {!unlocked && (
          <form className="admin-unlock" onSubmit={unlock}>
            <label>
              管理员口令
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="输入后可编辑员工信息" />
            </label>
            <button className="ghost">解锁管理</button>
            {authError && <div className="error">{authError}</div>}
          </form>
        )}
        <div className="employee-groups">
          {groups.map(({ group, employees: groupEmployees }) => (
            <section className="employee-group" key={group}>
              <div className="group-title">
                <strong>{group}</strong>
                <span>{groupEmployees.length}人</span>
              </div>
              <div className="employee-list">
                {groupEmployees.map((item) => (
                  <div className="employee-row" key={item.id}>
                    <strong>{item.name}</strong>
                    {unlocked && (
                      <div className="row-actions">
                        <button onClick={() => setEditing(structuredClone(item))}>编辑</button>
                        <button onClick={() => guardedRemove(item.id)}>删除</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      {unlocked && <section className="panel">
        <div className="panel-title"><h2>{editing ? "编辑员工" : "新增员工"}</h2></div>
        <form className="form-grid" onSubmit={save}>
          <label>
            姓名
            <input value={employee.name} onChange={(event) => setEditing({ ...employee, name: event.target.value })} required />
          </label>
          <label>
            组别
            <OptionPicker
              options={[
                { value: "老人组", label: "老人组", meta: "成熟员工" },
                { value: "新人组", label: "新人组", meta: "新员工" }
              ]}
              value={employee.group}
              onChange={(group) => setEditing({ ...employee, group })}
              placeholder="选择组别"
            />
          </label>
          {rows.map((row) => (
            <label key={row.key}>
              {row.label}指标
              <input
                type="number"
                step="any"
                value={employee.targets[row.key] || 0}
                onChange={(event) => setEditing({ ...employee, targets: { ...employee.targets, [row.key]: Number(event.target.value || 0) } })}
              />
            </label>
          ))}
          <button className="primary wide">保存</button>
        </form>
      </section>}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState({ employees: initialEmployees, records: initialRecords() });
  const [page, setPage] = useState("fill");
  const [error, setError] = useState("");

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
          <p className="eyebrow">刘娟工作台</p>
        </div>
      </header>
      {error && <div className="error banner">{error}</div>}
      <main className="content">
        {page === "fill" && <FillPage employees={employees} onAddRecord={addRecord} />}
        {page === "daily" && <DailyDataPage employees={employees} records={records} />}
        {page === "monthly" && <MonthlyPage employees={employees} records={records} />}
        {page === "manage" && <ManagePage employees={employees} onSaveEmployee={saveEmployee} onRemoveEmployee={removeEmployee} onSeed={seedInitialData} />}
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
