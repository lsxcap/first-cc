import { useState } from "react";
import { getEmployeeBackupMeta, restoreEmployeesFromBackup } from "../services/dataService.js";
import { indicatorRowsFor } from "../utils/metrics.js";
import OptionPicker from "../components/OptionPicker.jsx";

export default function ManagePage({ employees, onSaveEmployee, onRemoveEmployee, onSeed, adminUnlocked, onAdminUnlockedChange }) {
  const makeNewEmployee = () => ({
    id: `e${Date.now()}`,
    name: "",
    group: "老人组",
    targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 }
  });

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [draftEmployee, setDraftEmployee] = useState(makeNewEmployee);
  const unlocked = adminUnlocked;
  const [formOpen, setFormOpen] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [backupMeta, setBackupMeta] = useState(() => getEmployeeBackupMeta());

  const employee = editingEmployee || draftEmployee;
  const isEditing = Boolean(editingEmployee);
  const rows = indicatorRowsFor(employee);
  const groups = ["老人组", "新人组"].map((group) => ({
    group,
    employees: employees.filter((item) => item.group === group)
  })).filter((item) => item.employees.length);

  function unlock(event) {
    event.preventDefault();
    if (password === (import.meta.env.VITE_ADMIN_ACCESS_CODE || "123456")) {
      onAdminUnlockedChange(true);
      setAuthError("");
      setFormOpen(false);
    } else {
      setAuthError("管理员口令不正确");
    }
  }

  function lockManage() {
    onAdminUnlockedChange(false);
    setPassword("");
    setAuthError("");
    setFormOpen(false);
    setEditingEmployee(null);
    setDraftEmployee(makeNewEmployee());
    setSaveState("idle");
  }

  function openCreate() {
    setEditingEmployee(null);
    setDraftEmployee(makeNewEmployee());
    setSaveState("idle");
    setFormOpen(true);
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
      await onSaveEmployee(employee);
      setBackupMeta(getEmployeeBackupMeta());
      setSaveState("success");
      window.setTimeout(() => {
        closeForm();
      }, 1200);
    } catch {
      setSaveState("idle");
      alert("保存失败，请重试");
    }
  }

  async function guardedSeed() {
    if (!unlocked) return;
    const answer = prompt("此操作会重置为样例数据。请输入“确认重置”继续：", "");
    if (answer !== "确认重置") {
      alert("已取消重置");
      return;
    }
    await onSeed();
    alert("已重置为样例数据");
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
    if (confirm("确认删除这个员工？")) await onRemoveEmployee(employeeId);
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">管理区 {unlocked ? "· 管理员模式中" : ""}</p>
            <h2>员工与指标</h2>
          </div>
          {unlocked && (
            <div className="panel-actions">
              <button className="ghost" onClick={openCreate}>新增员工</button>
              <button className="ghost" onClick={guardedSeed}>初始化样例</button>
              <button className="ghost" onClick={restoreBackup}>恢复员工备份</button>
              <button className="ghost" onClick={lockManage}>退出管理</button>
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
                    <strong>{item.name}</strong>
                    {unlocked && (
                      <div className="row-actions">
                        <button onClick={() => openEdit(item)}>编辑</button>
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
      {unlocked && formOpen && (
        <section className="panel">
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
            {rows.map((row) => (
              <label key={row.key}>
                {row.label}指标
                <input
                  type="number"
                  step="any"
                  value={employee.targets[row.key] || 0}
                  onChange={(event) => {
                    const next = { ...employee, targets: { ...employee.targets, [row.key]: Number(event.target.value || 0) } };
                    if (isEditing) setEditingEmployee(next);
                    else setDraftEmployee(next);
                  }}
                />
              </label>
            ))}
            <button className={`primary wide ${saveState === "success" ? "success" : ""}`} disabled={saveState === "saving" || saveState === "success"}>
              {saveState === "saving" ? "保存中..." : saveState === "success" ? "✓ 保存成功" : "保存"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
