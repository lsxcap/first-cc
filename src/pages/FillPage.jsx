import { useEffect, useMemo, useState } from "react";
import { indicatorLabels, indicatorUnits } from "../config/data.js";
import { calculateDailyEffective, calculateProductSales, indicatorRowsFor, todayString } from "../utils/metrics.js";
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

export default function FillPage({ employees, records, onAddRecord, adminUnlocked }) {
  const today = todayString();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [date, setDate] = useState(today);
  const [values, setValues] = useState({});
  const [emptyCount, setEmptyCount] = useState("");
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState("idle");
  const [submitSuccessVisible, setSubmitSuccessVisible] = useState(false);

  const submittedMap = useMemo(() => {
    const map = {};
    for (const record of records) {
      const key = `${record.employeeId}_${record.date}`;
      if (!map[key]) map[key] = record;
    }
    return map;
  }, [records]);

  const submittedEmployees = useMemo(() => new Set(
    records.filter((record) => record.date === date).map((record) => record.employeeId)
  ), [records, date]);

  const pendingEmployees = useMemo(
    () => employees.filter((employee) => !submittedEmployees.has(employee.id)),
    [employees, submittedEmployees]
  );

  const sortedEmployees = useMemo(() => [
    ...pendingEmployees,
    ...employees.filter((employee) => submittedEmployees.has(employee.id))
  ], [employees, pendingEmployees, submittedEmployees]);

  const availableEmployees = sortedEmployees;

  const selectedEmployee = employees.find((item) => item.id === employeeId);
  const fillRows = selectedEmployee ? indicatorRowsFor(selectedEmployee) : [];
  const currentRecord = submittedMap[`${employeeId}_${date}`];
  const allSubmitted = employees.length > 0 && pendingEmployees.length === 0;
  const isSubmittedEmployee = Boolean(currentRecord);
  const isLocked = isSubmittedEmployee && !adminUnlocked;
  const formReadOnly = isLocked || submitState === "submitting" || submitSuccessVisible;
  const marginKey = selectedEmployee?.group === "新人组" ? "twoMarginNew" : "twoMarginValid";
  const rowByKey = Object.fromEntries(fillRows.map((row) => [row.key, row]));
  const getRowLabel = (key) => rowByKey[key]?.label || indicatorLabels[key];

  useEffect(() => {
    const canKeepSelected = availableEmployees.some((employee) => employee.id === employeeId);
    if (!canKeepSelected) {
      setEmployeeId(availableEmployees[0]?.id || "");
    }
  }, [availableEmployees, employeeId]);

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
        let rawValue = Number(values[row.key] || 0);
        let finalValue = rawValue;
        let detail = note;
        const extraRecordFields = {};

        if (row.key === "validAccount") {
          const dailyEffective = calculateDailyEffective({
            validAccounts: values.validAccount,
            emptyAccounts: emptyCount
          });
          rawValue = dailyEffective.validAccounts;
          finalValue = dailyEffective.dailyEffective;
          extraRecordFields.emptyAccounts = dailyEffective.emptyAccounts;
          extraRecordFields.convertedFromEmpty = dailyEffective.convertedFromEmpty;
          if (dailyEffective.convertedFromEmpty) detail = `${detail ? `${detail}；` : ""}空户折算+${dailyEffective.convertedFromEmpty}`;
        }
        if (row.key === "productSales") {
          const privateFund = Number(values.privateFund || 0);
          const publicFund = Number(values.publicFund || 0);
          const receipt = Number(values.receipt || 0);
          rawValue = privateFund + publicFund + receipt;
          finalValue = calculateProductSales({ privateFund, publicFund, receipt });
          extraRecordFields.privateFund = privateFund;
          extraRecordFields.publicFund = publicFund;
          extraRecordFields.receipt = receipt;
          detail = `${detail ? `${detail}；` : ""}产品销售折算：私募${privateFund}，公募${publicFund}，收凭${receipt}`;
        }
        if (!finalValue) continue;

        created.push(onAddRecord({
          employeeId,
          employeeName: employee.name,
          date,
          indicator: row.key,
          value: finalValue,
          rawValue,
          extraPoints: 0,
          note: detail,
          ...extraRecordFields
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
      setSubmitSuccessVisible(true);
      const submittedEmployeeId = employeeId;
      window.setTimeout(() => {
        const nextEmployee = pendingEmployees.find((item) => item.id !== submittedEmployeeId);
        setEmployeeId(nextEmployee?.id || submittedEmployeeId);
        setSubmitSuccessVisible(false);
        setSubmitState("idle");
      }, 1400);
    } catch {
      setSubmitState("idle");
    }
  }

  function updateValue(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const submitLabel = submitState === "submitting"
    ? "提交中..."
    : submitSuccessVisible
      ? `✓ ${selectedEmployee?.name || "该员工"}已提交`
      : isSubmittedEmployee
        ? "已提交"
        : allSubmitted
        ? "今日全部完成"
        : "提交业绩记录";

  const selectedMeta = `待填写 ${pendingEmployees.length}/${employees.length}`;
  const successHint = submitSuccessVisible ? "✓ 已提交，正在切换下一位" : "";

  return (
    <div className="page-grid">
      <section className="panel fill-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">今日填报</p>
            <h2>新增业绩记录</h2>
          </div>
          <div className="panel-actions">
            <strong>{selectedMeta}</strong>
            {successHint && <span className="admin-inline-tag">{successHint}</span>}
          </div>
        </div>
        <form className="work-form" onSubmit={submit}>
          <fieldset className="work-form-fieldset" disabled={submitState === "submitting"}>
            <section className="form-section">
              <div className="form-section-title">基本信息</div>
              <div className="performance-grid">
                <label className="form-field">
                  员工姓名
                  <EmployeePicker employees={availableEmployees} value={employeeId} onChange={setEmployeeId} />
                </label>
                <label className="form-field">
                  记录日期
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
              </div>
            </section>
          </fieldset>

          <fieldset className="work-form-fieldset" disabled={formReadOnly}>
            <section className="form-section">
              <div className="form-section-title">核心业绩指标</div>
              <div className="performance-grid">
                <MetricInput
                  label={getRowLabel("newAsset")}
                  unit={indicatorUnits.newAsset}
                  value={values.newAsset || ""}
                  onChange={(value) => updateValue("newAsset", value)}
                />
                <MetricInput
                  label={getRowLabel("investSign")}
                  unit={indicatorUnits.investSign}
                  value={values.investSign || ""}
                  onChange={(value) => updateValue("investSign", value)}
                />
                <MetricInput
                  label={getRowLabel("validAccount")}
                  unit={indicatorUnits.validAccount}
                  value={values.validAccount || ""}
                  onChange={(value) => updateValue("validAccount", value)}
                />
                <label className="form-field">
                  产品销售额-私募
                  <div className="input-unit">
                    <input type="text" inputMode="decimal" enterKeyHint="next" value={values.privateFund || ""} onChange={(event) => updateValue("privateFund", event.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
                    <span>万元</span>
                  </div>
                </label>
                <label className="form-field">
                  空户
                  <div className="input-unit">
                    <input type="text" inputMode="numeric" enterKeyHint="next" value={emptyCount} onChange={(event) => setEmptyCount(event.target.value.replace(/\D/g, ""))} placeholder="0" />
                    <span>户</span>
                  </div>
                </label>
                <label className="form-field">
                  产品销售额-公募
                  <div className="input-unit">
                    <input type="text" inputMode="decimal" enterKeyHint="next" value={values.publicFund || ""} onChange={(event) => updateValue("publicFund", event.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
                    <span>万元</span>
                  </div>
                </label>
                <MetricInput
                  label={getRowLabel(marginKey)}
                  unit={indicatorUnits[marginKey]}
                  value={values[marginKey] || ""}
                  onChange={(value) => updateValue(marginKey, value)}
                />
                <label className="form-field">
                  产品销售额-收凭
                  <div className="input-unit">
                    <input type="text" inputMode="decimal" enterKeyHint="next" value={values.receipt || ""} onChange={(event) => updateValue("receipt", event.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
                    <span>万元</span>
                  </div>
                </label>
              </div>
            </section>

            <section className="form-section">
              <div className="support-grid">
                <label className="form-field">
                  其他积分
                  <div className="input-unit">
                    <input type="text" inputMode="decimal" enterKeyHint="next" value={values.extraT0 || ""} onChange={(event) => updateValue("extraT0", event.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
                    <span>分</span>
                  </div>
                </label>
                <label className="form-field">
                  备注信息
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="填写备注..." />
                </label>
              </div>
            </section>
          </fieldset>

          {allSubmitted && <div className="submitted-banner">✓ 今日全部员工已填报完成</div>}
          {isSubmittedEmployee && <div className="submitted-banner">✓ {selectedEmployee?.name || "该员工"}在{date}已提交，可切换其他员工继续填报。</div>}

          <button className={`primary submit-wide ${submitState === "success" ? "success" : ""}`} disabled={submitState === "submitting" || submitSuccessVisible || isSubmittedEmployee || !selectedEmployee}>
            {submitLabel}
          </button>
        </form>
      </section>

      <AssessmentOverview />
    </div>
  );
}
