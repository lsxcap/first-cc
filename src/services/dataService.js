import { initialEmployees, initialRecords } from "../config/data.js";

const EMPLOYEE_KEY = "juan_workbench_employees";
const EMPLOYEE_BACKUP_KEY = "juan_workbench_employees_backup";
const RECORD_KEY = "juan_workbench_records";

const localSubscribers = new Set();

function loadLocal(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
  } catch {
    // Ignore damaged local demo data.
  }
  localStorage.setItem(key, JSON.stringify(fallback));
  return fallback;
}

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmployeeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.employees)) return value.employees;
  return [];
}

function emitLocalSnapshot() {
  const snapshot = loadLocalSnapshot();
  localSubscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener errors.
    }
  });
}

export function loadLocalSnapshot() {
  return {
    employees: loadLocal(EMPLOYEE_KEY, initialEmployees),
    records: loadLocal(RECORD_KEY, initialRecords())
  };
}

export function getEmployeeBackupMeta() {
  try {
    const backup = JSON.parse(localStorage.getItem(EMPLOYEE_BACKUP_KEY) || "null");
    if (!backup?.savedAt || !Array.isArray(backup?.employees)) return null;
    return {
      savedAt: backup.savedAt,
      count: backup.employees.length
    };
  } catch {
    return null;
  }
}

export function restoreEmployeesFromBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem(EMPLOYEE_BACKUP_KEY) || "null");
    if (!backup?.savedAt || !Array.isArray(backup?.employees)) return false;
    saveLocal(EMPLOYEE_KEY, backup.employees);
    emitLocalSnapshot();
    return true;
  } catch {
    return false;
  }
}

export function subscribeData(onData) {
  onData(loadLocalSnapshot());
  localSubscribers.add(onData);
  return () => {
    localSubscribers.delete(onData);
  };
}

export async function seedInitialData() {
  saveLocal(EMPLOYEE_KEY, initialEmployees);
  saveLocal(RECORD_KEY, initialRecords());
  emitLocalSnapshot();
}

export async function addRecord(record) {
  const current = loadLocal(RECORD_KEY, initialRecords());
  saveLocal(RECORD_KEY, [{ ...record, id: `local-${Date.now()}` }, ...current]);
  emitLocalSnapshot();
}

export async function saveEmployee(employee) {
  const currentRaw = loadLocal(EMPLOYEE_KEY, initialEmployees);
  const current = normalizeEmployeeList(currentRaw);
  if (!current.length && initialEmployees.length) {
    throw new Error("员工数据源异常，请先恢复后再保存");
  }

  saveLocal(EMPLOYEE_BACKUP_KEY, {
    savedAt: Date.now(),
    employees: current
  });

  const exists = current.some((item) => item.id === employee.id);
  const next = exists ? current.map((item) => (item.id === employee.id ? employee : item)) : [...current, employee];

  if (!exists && current.length > 1 && next.length <= 1) {
    throw new Error("检测到覆盖风险，已阻止保存");
  }

  saveLocal(EMPLOYEE_KEY, next);
  emitLocalSnapshot();
}

export async function removeEmployee(employeeId) {
  const current = loadLocal(EMPLOYEE_KEY, initialEmployees);
  saveLocal(EMPLOYEE_KEY, current.filter((item) => item.id !== employeeId));
  emitLocalSnapshot();
}

export async function updateRecord(recordId, patch) {
  const current = loadLocal(RECORD_KEY, initialRecords());
  saveLocal(RECORD_KEY, current.map((item) => (item.id === recordId ? { ...item, ...patch } : item)));
  emitLocalSnapshot();
}

export async function removeRecordsByEmployeeDate(employeeId, date) {
  const current = loadLocal(RECORD_KEY, initialRecords());
  saveLocal(RECORD_KEY, current.filter((item) => !(item.employeeId === employeeId && item.date === date)));
  emitLocalSnapshot();
}
