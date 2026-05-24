import { db, remoteNow, remoteReady } from "../services/cloudbase.js";
import { emptyTargets, initialEmployees, initialRecords } from "../config/data.js";

const STORAGE_VERSION = "v5";
const EMPLOYEE_KEY = `juan_workbench_employees_${STORAGE_VERSION}`;
const EMPLOYEE_BACKUP_KEY = `juan_workbench_employees_backup_${STORAGE_VERSION}`;
const DELETED_EMPLOYEE_KEY = `juan_workbench_deleted_employees_${STORAGE_VERSION}`;
const RECORD_KEY = `juan_workbench_records_${STORAGE_VERSION}`;
const REMOTE_TIMEOUT_MS = 8000;

const localSubscribers = new Set();
const remoteRefreshers = new Set();
const baseEmployeeIds = new Set(initialEmployees.map((employee) => employee.id));
const baseEmployeeOrder = new Map(initialEmployees.map((employee, index) => [employee.id, index]));

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

function withTimeout(promise, timeoutMs, message = "远程服务连接超时") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

function makeRecordId(record) {
  const source = `${record.employeeId || "employee"}_${record.date || "date"}_${record.indicator || "metric"}`;
  return source.replace(/[^\w-]/g, "_");
}

function normalizeRecordForLocal(record, patch = {}) {
  const id = record.id || record.clientMutationId || makeRecordId(record);
  return {
    ...record,
    id,
    clientMutationId: id,
    ...patch
  };
}

function saveLocalRecord(record) {
  const current = loadLocal(RECORD_KEY, initialRecords());
  const nextRecord = normalizeRecordForLocal(record);
  const exists = current.some((item) => item.id === nextRecord.id);
  const next = exists
    ? current.map((item) => (item.id === nextRecord.id ? { ...item, ...nextRecord } : item))
    : [nextRecord, ...current];
  saveLocal(RECORD_KEY, next);
}

function loadPendingRecords() {
  return loadLocal(RECORD_KEY, initialRecords()).filter((record) => record.syncStatus === "pending");
}

function mergeRemoteWithPending(remoteRecords) {
  const byId = new Map(remoteRecords.map((record) => [record.id, record]));
  for (const record of loadPendingRecords()) {
    byId.set(record.id, record);
  }
  return [...byId.values()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function cleanRemoteRecord(record) {
  const remoteRecord = { ...record };
  delete remoteRecord.syncStatus;
  delete remoteRecord.syncError;
  delete remoteRecord.queuedAt;
  return remoteRecord;
}

function normalizeEmployeeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.employees)) return value.employees;
  return [];
}

function normalizeEmployee(employee) {
  return {
    ...employee,
    targets: { ...(employee.targets || {}) }
  };
}

function orderEmployeeList(employees) {
  return [...employees].sort((a, b) => {
    const orderA = baseEmployeeOrder.has(a.id) ? baseEmployeeOrder.get(a.id) : Number.MAX_SAFE_INTEGER;
    const orderB = baseEmployeeOrder.has(b.id) ? baseEmployeeOrder.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
  });
}

function clearEmployeeTargets(employee) {
  return {
    id: employee.id,
    name: employee.name,
    group: employee.group,
    targets: { ...emptyTargets }
  };
}

function loadDeletedEmployeeIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(DELETED_EMPLOYEE_KEY) || "[]");
    return Array.isArray(saved) ? new Set(saved) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeletedEmployeeIds(ids) {
  saveLocal(DELETED_EMPLOYEE_KEY, [...ids]);
}

function syncDeletedBaseIdsFromEmployees(employees) {
  const ids = new Set();
  const employeeIds = new Set(employees.map((employee) => employee.id));
  for (const baseId of baseEmployeeIds) {
    if (!employeeIds.has(baseId)) ids.add(baseId);
  }
  saveDeletedEmployeeIds(ids);
  return ids;
}

function remoteCollection(name) {
  if (!db) return null;
  return db.collection(name);
}

function remoteDoc(name, id) {
  return remoteCollection(name)?.doc(id);
}

function normalizeRemoteRow(row) {
  const id = row.id || row._id;
  const next = { ...row, id };
  delete next._id;
  return next;
}

async function getRemoteCollection(name, sortField, sortDirection = "asc") {
  let queryRef = remoteCollection(name);
  if (!queryRef) return [];
  if (sortField) queryRef = queryRef.orderBy(sortField, sortDirection);
  const result = await withTimeout(queryRef.limit(1000).get(), REMOTE_TIMEOUT_MS);
  return (result?.data || []).map(normalizeRemoteRow);
}

function protectEmployeeList(value, options = {}) {
  const { restoreMissingBase = true, useDeletedIds = true } = options;
  const deletedEmployeeIds = useDeletedIds ? loadDeletedEmployeeIds() : new Set();
  const current = normalizeEmployeeList(value).filter((employee) => employee?.id && employee?.name && !deletedEmployeeIds.has(employee.id));
  const baseEmployees = restoreMissingBase ? initialEmployees.filter((employee) => !deletedEmployeeIds.has(employee.id)) : [];
  const currentBaseCount = current.filter((employee) => baseEmployeeIds.has(employee.id)).length;
  const hasCustomEmployees = current.some((employee) => !baseEmployeeIds.has(employee.id));

  if (!current.length && restoreMissingBase) {
    return baseEmployees.map(normalizeEmployee);
  }

  if (restoreMissingBase && !deletedEmployeeIds.size && !hasCustomEmployees && currentBaseCount > 0 && currentBaseCount < Math.ceil(initialEmployees.length / 2)) {
    return initialEmployees.map(normalizeEmployee);
  }

  const byId = new Map(baseEmployees.map((employee) => [employee.id, normalizeEmployee(employee)]));

  for (const employee of current) {
    if (baseEmployeeIds.has(employee.id) && byId.has(employee.id)) {
      byId.set(employee.id, {
        ...byId.get(employee.id),
        ...normalizeEmployee(employee),
        targets: {
          ...(byId.get(employee.id)?.targets || {}),
          ...(employee.targets || {})
        }
      });
    }
  }

  const customEmployees = current.filter((employee) => !restoreMissingBase || !baseEmployeeIds.has(employee.id));
  const next = restoreMissingBase
    ? [...baseEmployees.map((employee) => byId.get(employee.id) || normalizeEmployee(employee)), ...customEmployees]
    : customEmployees.map(normalizeEmployee);
  return orderEmployeeList(next);
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
  remoteRefreshers.forEach((refresh) => {
    try {
      refresh();
    } catch {
      // Ignore listener errors.
    }
  });
}

export function loadLocalSnapshot() {
  const employees = protectEmployeeList(loadLocal(EMPLOYEE_KEY, initialEmployees));
  saveLocal(EMPLOYEE_KEY, employees);
  return {
    employees,
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
    syncDeletedBaseIdsFromEmployees(backup.employees);
    saveLocal(EMPLOYEE_KEY, protectEmployeeList(backup.employees));
    emitLocalSnapshot();
    return true;
  } catch {
    return false;
  }
}

export function subscribeData(onData, onError) {
  if (!remoteReady || !db) {
    return subscribeLocalData(onData);
  }

  let employees = [];
  let records = [];
  let active = true;
  let refreshing = false;

  const refresh = async () => {
    if (!active || refreshing) return;
    refreshing = true;
    try {
      const [employeeDocs, recordDocs] = await Promise.all([
        getRemoteCollection("employees", "name", "asc"),
        getRemoteCollection("records", "date", "desc")
      ]);
      if (!active) return;
      employees = employeeDocs.length
        ? protectEmployeeList(employeeDocs, { restoreMissingBase: false, useDeletedIds: false })
        : initialEmployees.map(normalizeEmployee);
      records = recordDocs.length ? recordDocs : initialRecords();
      onData({ employees, records: mergeRemoteWithPending(records) });
      syncPendingRecords().catch(onError);
    } catch (err) {
      if (!active) return;
      onError?.(err);
      const localSnapshot = loadLocalSnapshot();
      onData({
        employees: employees.length ? employees : localSnapshot.employees,
        records: mergeRemoteWithPending(records.length ? records : localSnapshot.records)
      });
    } finally {
      refreshing = false;
    }
  };

  refresh();
  const refreshTimer = window.setInterval(refresh, 10000);
  remoteRefreshers.add(refresh);

  return () => {
    active = false;
    window.clearInterval(refreshTimer);
    remoteRefreshers.delete(refresh);
  };
}

export function subscribeLocalData(onData) {
  onData(loadLocalSnapshot());
  localSubscribers.add(onData);
  return () => {
    localSubscribers.delete(onData);
  };
}

export async function syncPendingRecords() {
  if (!remoteReady || !db) return { synced: 0, pending: loadPendingRecords().length };
  const pendingRecords = loadPendingRecords();
  if (!pendingRecords.length) return { synced: 0, pending: 0 };

  let synced = 0;
  for (const record of pendingRecords) {
    await withTimeout(
      remoteDoc("records", record.id).set({
        ...cleanRemoteRecord(record),
        syncedAt: remoteNow()
      }),
      REMOTE_TIMEOUT_MS
    );
    synced += 1;
  }

  const syncedIds = new Set(pendingRecords.map((record) => record.id));
  const remainingLocalRecords = loadLocal(RECORD_KEY, initialRecords()).filter((record) => !syncedIds.has(record.id));
  saveLocal(RECORD_KEY, remainingLocalRecords);
  emitLocalSnapshot();
  return { synced, pending: remainingLocalRecords.filter((record) => record.syncStatus === "pending").length };
}

export async function initializeProductionData() {
  const sourceEmployees = initialEmployees.map(normalizeEmployee);
  const cleanEmployees = sourceEmployees.map(clearEmployeeTargets);

  if (!remoteReady || !db) {
    saveDeletedEmployeeIds(new Set());
    saveLocal(EMPLOYEE_BACKUP_KEY, {
      savedAt: Date.now(),
      employees: protectEmployeeList(loadLocal(EMPLOYEE_KEY, initialEmployees))
    });
    saveLocal(EMPLOYEE_KEY, cleanEmployees);
    saveLocal(RECORD_KEY, []);
    emitLocalSnapshot();
    return;
  }

  const employeesSnapshot = await getRemoteCollection("employees");
  const customEmployeeDocs = employeesSnapshot.filter((item) => !baseEmployeeIds.has(item.id));
  await Promise.all([
    ...customEmployeeDocs.map((item) => withTimeout(remoteDoc("employees", item.id).remove(), REMOTE_TIMEOUT_MS)),
    ...cleanEmployees.map((employee) => withTimeout(remoteDoc("employees", employee.id).set(employee), REMOTE_TIMEOUT_MS))
  ]);

  const recordsSnapshot = await getRemoteCollection("records");
  await Promise.all(recordsSnapshot.map((item) => withTimeout(remoteDoc("records", item.id).remove(), REMOTE_TIMEOUT_MS)));
}

export async function addRecord(record) {
  const localRecord = normalizeRecordForLocal(record);
  if (!remoteReady || !db) {
    saveLocalRecord({
      ...localRecord,
      syncStatus: "pending",
      syncError: "远程数据库未配置，已保存在本机",
      queuedAt: Date.now()
    });
    emitLocalSnapshot();
    return { status: "queued", record: localRecord };
  }

  try {
    await withTimeout(
      remoteDoc("records", localRecord.id).set({
        ...cleanRemoteRecord(localRecord),
        createdAt: remoteNow()
      }),
      REMOTE_TIMEOUT_MS
    );
    return { status: "remote", record: localRecord };
  } catch (err) {
    saveLocalRecord({
      ...localRecord,
      syncStatus: "pending",
      syncError: err?.message || "远程数据库暂时不可用",
      queuedAt: Date.now()
    });
    emitLocalSnapshot();
    return { status: "queued", record: localRecord };
  }
}

export async function saveEmployee(employee) {
  if (baseEmployeeIds.has(employee.id)) {
    const deletedEmployeeIds = loadDeletedEmployeeIds();
    deletedEmployeeIds.delete(employee.id);
    saveDeletedEmployeeIds(deletedEmployeeIds);
  }

  if (!remoteReady || !db) {
    const current = protectEmployeeList(loadLocal(EMPLOYEE_KEY, initialEmployees));
    if (!current.length && initialEmployees.length) {
      throw new Error("员工数据源异常，请先恢复后再保存");
    }

    saveLocal(EMPLOYEE_BACKUP_KEY, {
      savedAt: Date.now(),
      employees: current
    });

    const exists = current.some((item) => item.id === employee.id);
    const next = protectEmployeeList(exists ? current.map((item) => (item.id === employee.id ? employee : item)) : [...current, employee]);

    saveLocal(EMPLOYEE_KEY, next);
    emitLocalSnapshot();
    return;
  }
  await withTimeout(remoteDoc("employees", employee.id).set(employee), REMOTE_TIMEOUT_MS);
}

export async function removeEmployee(employeeId) {
  if (baseEmployeeIds.has(employeeId)) {
    const deletedEmployeeIds = loadDeletedEmployeeIds();
    deletedEmployeeIds.add(employeeId);
    saveDeletedEmployeeIds(deletedEmployeeIds);
  }
  if (!remoteReady || !db) {
    const current = protectEmployeeList(loadLocal(EMPLOYEE_KEY, initialEmployees));
    saveLocal(EMPLOYEE_BACKUP_KEY, {
      savedAt: Date.now(),
      employees: current
    });
    saveLocal(EMPLOYEE_KEY, current.filter((item) => item.id !== employeeId));
    emitLocalSnapshot();
    return;
  }
  await withTimeout(remoteDoc("employees", employeeId).remove(), REMOTE_TIMEOUT_MS);
}

export async function updateRecord(recordId, patch) {
  if (!remoteReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, current.map((item) => (item.id === recordId ? { ...item, ...patch } : item)));
    emitLocalSnapshot();
    return;
  }
  await withTimeout(remoteDoc("records", recordId).update(patch), REMOTE_TIMEOUT_MS);
}

export async function removeRecordsByEmployeeDate(employeeId, date) {
  if (!remoteReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, current.filter((item) => !(item.employeeId === employeeId && item.date === date)));
    emitLocalSnapshot();
    return;
  }

  const result = await withTimeout(
    remoteCollection("records").where({ employeeId, date }).get(),
    REMOTE_TIMEOUT_MS
  );
  const targets = (result?.data || []).map(normalizeRemoteRow);
  await Promise.all(targets.map((item) => withTimeout(remoteDoc("records", item.id).remove(), REMOTE_TIMEOUT_MS)));
}
