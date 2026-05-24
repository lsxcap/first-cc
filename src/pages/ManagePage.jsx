import { useRef, useState } from "react";
import { getEmployeeBackupMeta, restoreEmployeesFromBackup } from "../services/dataService.js";
import { indicatorLabels } from "../config/data.js";
import OptionPicker from "../components/OptionPicker.jsx";

const REQUIRED_TARGET_KEYS = ["validAccount", "newAsset", "investSign", "twoMarginValid", "productSales"];
const EXTRA_TARGET_KEYS = ["twoMarginNew"];

function targetRowsForEdit(employee) {
  const keys = employee.group === "新人组"
    ? [...REQUIRED_TARGET_KEYS, ...EXTRA_TARGET_KEYS]
    : REQUIRED_TARGET_KEYS;
  return keys.map((key) => ({
    key,
    label: indicatorLabels[key],
    target: employee.targets?.[key] || 0
  }));
}

function normalizeEmployeeTargets(employee) {
  const targetKeys = [...REQUIRED_TARGET_KEYS, ...EXTRA_TARGET_KEYS];
  return {
    ...employee,
    targets: targetKeys.reduce((next, key) => {
      next[key] = Number(employee.targets?.[key] || 0);
      return next;
    }, {})
  };
}

export default function ManagePage({ employees, onSaveEmployee, onRemoveEmployee, onInitializeProductionData, isAdmin, onSetAdmin }) {
  const makeNewEmployee = () => ({
    id: `employee-${globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Date.now()}`,
    name: "",
    group: "老人组",
    targets: { validAccount: 0, newAsset: 0, investSign: 0, twoMarginValid: 0, productSales: 0, twoMarginNew: 0 }
  });

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [draftEmployee, setDraftEmployee] = useState(makeNewEmployee);
  const unlocked = isAdmin;
  const [formOpen, setFormOpen] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [backupMeta, setBackupMeta] = useState(() => getEmployeeBackupMeta());
  const createFormRef = useRef(null);
  const firstFieldRef = useRef(null);

  const employee = editingEmployee || draftEmployee;
  const isEditing = Boolean(editingEmployee);
  const rows = targetRowsForEdit(employee);
  const groups = ["老人组", "新人组"].map((group) => ({
    group,
    employees: employees.filter((item) => item.group === group)
  })).filter((item) => item.employees.length);

  function unlock(event) {
    event.preventDefault();

    if (password === (import.meta.env.VITE_ADMIN_ACCESS_CODE || "123456")) {
      onSetAdmin(true);
      setAuthError("");
      setFormOpen(false);
    } else {
      setAuthError("管理员口令不正确");
    }
  }

  function openCreate() {
    setEditingEmployee(null);
    setDraftEmployee(makeNewEmployee());
    setSaveState("idle");
    setFormOpen(true);
    window.setTimeout(() => {
      createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      firstFieldRef.current?.focus();
    }, 0);
  }

  function openEdit(item) {
    setEditingEmployee(structuredClone(item));
    setSaveState("idle");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingEmployee(null);
    setDraftEmployee(makeNewEmployee());
    setSaveState("idle");
  }

  async function save(event) {
    event.preventDefault();
    if (!unlocked) return;
    if (saveState === "saving") return;
    setSaveState("saving");
    try {
      await onSaveEmployee(normalizeEmployeeTargets(employee));
      setBackupMeta(getEmployeeBackupMeta());
      setSaveState("success");
      window.setTimeout(() => {
        closeForm();
      }, 1200);
    } catch (err) {
      setSaveState("idle");
      alert(err?.message || "保存失败，请重试");
    }
  }

  async function initializeFormalData() {
    if (!unlocked) return;
    const answer = prompt("此操作会保留员工姓名和分组，清空所有日报、月报、积分、备注和员工指标。请输入“确认初始化”继续：", "");
    if (answer !== "确认初始化") {
      alert("已取消初始化");
      return;
    }
    try {
      await onInitializeProductionData();
      setBackupMeta(getEmployeeBackupMeta());
      closeForm();
      alert("已初始化为正式环境数据");
    } catch (err) {
      alert(err?.message || "初始化失败，请重试");
    }
  }

  function restoreBackup() {
    if (!unlocked) return;
    if (!backupMeta) {
      alert("暂无可恢复的员工备份");
      return;
    }
    const ok = confirm("确认使用最近一次本地备份覆盖当前员工列表？");
    if (!ok) return;
    const restored = restoreEmployeesFromBackup();
    if (restored) {
      setBackupMeta(getEmployeeBackupMeta());
      alert("已从本地备份恢复员工列表");
    } else {
      alert("恢复失败：未找到有效备份");
    }
  }

  async function guardedRemove(employeeId) {
    if (!unlocked) return;
    const employee = employees.find((item) => item.id === employeeId);
    if (!confirm(`确认删除${employee?.name ? ` ${employee.name} ` : "该员工"}吗？\n删除后该员工将从员工管理、今日填报、每日数据、月度看板中移除。`)) return;
    try {
      await onRemoveEmployee(employeeId);
      setBackupMeta(getEmployeeBackupMeta());
      if (editingEmployee?.id === employeeId) closeForm();
    } catch (err) {
      alert(err?.message || "删除失败，请重试");
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">{unlocked ? "管理模式中" : "管理区"}</p>
            <h2>员工与指标</h2>
          </div>
          {unlocked && (
            <div className="panel-actions admin-actions-group">
              <button type="button" className="primary action-main" onClick={openCreate}>新增员工</button>
              <button type="button" className="ghost action-secondary" onClick={initializeFormalData}>初始化</button>
              <button type="button" className="ghost action-secondary" onClick={restoreBackup}>恢复员工备份</button>
            </div>
          )}
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
                    <strong className="employee-name">{item.name}</strong>
                    {unlocked && (
                      <div className="row-actions">
                        <button type="button" className="employee-action-button" onClick={() => openEdit(item)} aria-label={`编辑员工 ${item.name}`} title="编辑员工">
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M4 20h4.2L19 9.2 14.8 5 4 15.8V20Z" />
                            <path d="m13.8 6 4.2 4.2" />
                          </svg>
                        </button>
                        <button type="button" className="employee-action-button danger" onClick={() => guardedRemove(item.id)} aria-label={`删除员工 ${item.name}`} title="删除员工">
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M5 7h14" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M8 7l1-3h6l1 3" />
                            <path d="M7 7l1 13h8l1-13" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
      {unlocked && formOpen && (
        <section className="panel manage-form-panel" ref={createFormRef}>
          <div className="panel-title">
            <h2>{isEditing ? "编辑员工" : "新增员工"}</h2>
            <div className="panel-actions">
              <button type="button" className="ghost" onClick={closeForm}>← 返回</button>
            </div>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label>
              姓名
              <input
                ref={firstFieldRef}
                value={employee.name}
                onChange={(event) => {
                  const next = { ...employee, name: event.target.value };
                  if (isEditing) setEditingEmployee(next);
                  else setDraftEmployee(next);
                }}
                required
              />
            </label>
            <label>
              组别
              <OptionPicker
                options={[
                  { value: "老人组", label: "老人组", meta: "成熟员工" },
                  { value: "新人组", label: "新人组", meta: "新员工" }
                ]}
                value={employee.group}
                onChange={(group) => {
                  const next = { ...employee, group };
                  if (isEditing) setEditingEmployee(next);
                  else setDraftEmployee(next);
                }}
                placeholder="选择组别"
              />
            </label>
            <div className="target-config-section wide">
              <div className="target-config-title">
                <h3>个人月度指标</h3>
                <span>保存后同步到每日数据月报和月度看板</span>
              </div>
              <div className="target-config-grid">
                {rows.map((row) => (
                  <label key={row.key}>
                    {row.label}指标
                    <input
                      type="number"
                      step="any"
                      value={Number(employee.targets?.[row.key] || 0) === 0 ? "" : employee.targets[row.key]}
                      placeholder="0"
                      onChange={(event) => {
                        const next = { ...employee, targets: { ...employee.targets, [row.key]: Number(event.target.value || 0) } };
                        if (isEditing) setEditingEmployee(next);
                        else setDraftEmployee(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <button className={`primary wide ${saveState === "success" ? "success" : ""}`} disabled={saveState === "saving" || saveState === "success"}>
              {saveState === "saving" ? "保存中..." : saveState === "success" ? "✓ 保存成功" : "保存"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
