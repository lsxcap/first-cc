import { useEffect, useState } from "react";
import { indicatorLabels, indicatorUnits } from "../config/data.js";
import { indicatorRowsFor, todayString } from "../utils/metrics.js";
import MetricInput from "../components/MetricInput.jsx";
import OptionPicker from "../components/OptionPicker.jsx";

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

export default function FillPage({ employees, records, onAddRecord, onClearRecordsByDate, adminUnlocked }) {
  const today = todayString();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [date, setDate] = useState(today);
  const [productType, setProductType] = useState("private");
  const [values, setValues] = useState({});
  const [emptyCount, setEmptyCount] = useState("");
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState("idle");

  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const fillRows = selectedEmployee ? indicatorRowsFor(selectedEmployee) : [];
  const hasSubmittedForDay = Boolean(records.some((record) => record.employeeId === employeeId && record.date === date));
  const isLocked = hasSubmittedForDay && !adminUnlocked;
  const marginKey = selectedEmployee?.group === "新人组" ? "twoMarginNew" : "twoMarginValid";
  const rowByKey = Object.fromEntries(fillRows.map((row) => [row.key, row]));

  useEffect(() => {
    if (!employeeId && employees[0]?.id) setEmployeeId(employees[0].id);
  }, [employeeId, employees]);

  async function submit(event) {
    event.preventDefault();
    if (submitState === "submitting") return;
    if (isLocked) {
      setSubmitState("locked");
      return;
    }
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const created = [];
    setSubmitState("submitting");

    try {
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

      if (!created.length) {
        setSubmitState("idle");
        return;
      }
      await Promise.all(created);
      setValues({});
      setEmptyCount("");
      setNote("");
      setSubmitState("success");
    } catch {
      setSubmitState("idle");
    }
  }

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function clearTodayRecords() {
    if (!adminUnlocked || !employeeId || !date) return;
    if (!confirm("确认清除该员工当天填报记录并重新开放编辑？")) return;
    await onClearRecordsByDate(employeeId, date);
    setSubmitState("idle");
  }

  const submitLabel = submitState === "submitting"
    ? "提交中..."
    : isLocked
      ? "✓ 已提交"
      : submitState === "success"
        ? "✓ 提交成功"
        : "提交业绩记录";

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
          <fieldset className="work-form-fieldset" disabled={isLocked}>
            <section className="form-section">
              <div className="form-section-title">基本信息</div>
              <div className="performance-grid">
                <label className="form-field">
                  员工姓名
                  <EmployeePicker employees={employees} value={employeeId} onChange={setEmployeeId} />
                </label>
                <label className="form-field">
                  记录日期
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={isLocked} />
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="form-section-title">核心业绩指标</div>
              <div className="performance-grid">
                {rowByKey.newAsset && (
                  <MetricInput
                    label={rowByKey.newAsset.label}
                    unit={indicatorUnits.newAsset}
                    value={values.newAsset || ""}
                    onChange={(value) => updateValue("newAsset", value)}
                  />
                )}
                {rowByKey.investSign && (
                  <MetricInput
                    label={rowByKey.investSign.label}
                    unit={indicatorUnits.investSign}
                    value={values.investSign || ""}
                    onChange={(value) => updateValue("investSign", value)}
                  />
                )}
                {rowByKey.validAccount && (
                  <label className="form-field">
                    有效户 / 空户数
                    <div className="compound-row">
                      <div className="input-unit">
                        <input type="text" inputMode="decimal" enterKeyHint="next" value={values.validAccount || ""} onChange={(event) => updateValue("validAccount", event.target.value.replace(/[^\d.]/g, ""))} placeholder="有效户" />
                        <span>户</span>
                      </div>
                      <div className="input-unit">
                        <input type="text" inputMode="numeric" enterKeyHint="next" value={emptyCount} onChange={(event) => setEmptyCount(event.target.value.replace(/\D/g, ""))} placeholder="空户数" />
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
                        <input type="text" inputMode="decimal" enterKeyHint="next" value={values.productSales || ""} onChange={(event) => updateValue("productSales", event.target.value.replace(/[^\d.]/g, ""))} placeholder="金额" />
                        <span>万元</span>
                      </div>
                      <ProductTypePicker value={productType} onChange={setProductType} />
                    </div>
                  </label>
                )}
                {rowByKey[marginKey] && (
                  <MetricInput
                    label={rowByKey[marginKey].label}
                    unit={indicatorUnits[marginKey]}
                    value={values[marginKey] || ""}
                    onChange={(value) => updateValue(marginKey, value)}
                  />
                )}
                <label className="form-field">
                  额外加分
                  <div className="input-unit">
                    <input type="text" inputMode="decimal" enterKeyHint="done" value={values.extraT0 || ""} onChange={(event) => updateValue("extraT0", event.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
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
          </fieldset>

          {isLocked && <div className="submitted-banner">✓ 当日已提交，普通员工不可修改</div>}

          <button className={`primary submit-wide ${submitState === "success" || isLocked ? "success" : ""}`} disabled={submitState === "submitting" || isLocked}>
            {submitLabel}
          </button>
          {adminUnlocked && hasSubmittedForDay && (
            <button type="button" className="ghost submit-wide" onClick={clearTodayRecords}>
              清除当日填报并重新编辑
            </button>
          )}
        </form>
      </section>

      <AssessmentOverview />
    </div>
  );
}
