import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db, firebaseReady } from "../services/firebase.js";
import { emptyTargets, initialEmployees, initialRecords } from "../config/data.js";

const STORAGE_VERSION = "v4";
const EMPLOYEE_KEY = `juan_workbench_employees_${STORAGE_VERSION}`;
const EMPLOYEE_BACKUP_KEY = `juan_workbench_employees_backup_${STORAGE_VERSION}`;
const DELETED_EMPLOYEE_KEY = `juan_workbench_deleted_employees_${STORAGE_VERSION}`;
const RECORD_KEY = `juan_workbench_records_${STORAGE_VERSION}`;

const localSubscribers = new Set();
const baseEmployeeIds = new Set(initialEmployees.map((employee) => employee.id));

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

function normalizeEmployee(employee) {
  return {
    ...employee,
    targets: { ...(employee.targets || {}) }
  };
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

function protectEmployeeList(value) {
  const deletedEmployeeIds = loadDeletedEmployeeIds();
  const current = normalizeEmployeeList(value).filter((employee) => employee?.id && employee?.name && !deletedEmployeeIds.has(employee.id));
  const baseEmployees = initialEmployees.filter((employee) => !deletedEmployeeIds.has(employee.id));
  const currentBaseCount = current.filter((employee) => baseEmployeeIds.has(employee.id)).length;
  const hasCustomEmployees = current.some((employee) => !baseEmployeeIds.has(employee.id));

  if (!current.length) {
    return baseEmployees.map(normalizeEmployee);
  }

  if (!deletedEmployeeIds.size && !hasCustomEmployees && currentBaseCount > 0 && currentBaseCount < Math.ceil(initialEmployees.length / 2)) {
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

  const customEmployees = current.filter((employee) => !baseEmployeeIds.has(employee.id));
  return [...baseEmployees.map((employee) => byId.get(employee.id) || normalizeEmployee(employee)), ...customEmployees];
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
  if (!firebaseReady || !db) {
    onData(loadLocalSnapshot());
    localSubscribers.add(onData);
    return () => {
      localSubscribers.delete(onData);
    };
  }

  let employees = [];
  let records = [];
  let readyEmployees = false;
  let readyRecords = false;

  const emit = () => {
    if (readyEmployees && readyRecords) onData({ employees, records });
  };

  const unsubEmployees = onSnapshot(
    query(collection(db, "employees"), orderBy("name")),
    (snapshot) => {
      employees = protectEmployeeList(snapshot.empty ? initialEmployees : snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      readyEmployees = true;
      emit();
    },
    onError
  );

  const unsubRecords = onSnapshot(
    query(collection(db, "records"), orderBy("date", "desc")),
    (snapshot) => {
      records = snapshot.empty ? initialRecords() : snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      readyRecords = true;
      emit();
    },
    onError
  );

  return () => {
    unsubEmployees();
    unsubRecords();
  };
}

export async function initializeProductionData(employees = []) {
  const sourceEmployees = protectEmployeeList(employees.length ? employees : loadLocal(EMPLOYEE_KEY, initialEmployees));
  const cleanEmployees = sourceEmployees.map(clearEmployeeTargets);

  if (!firebaseReady || !db) {
    syncDeletedBaseIdsFromEmployees(cleanEmployees);
    saveLocal(EMPLOYEE_BACKUP_KEY, {
      savedAt: Date.now(),
      employees: sourceEmployees
    });
    saveLocal(EMPLOYEE_KEY, cleanEmployees);
    saveLocal(RECORD_KEY, []);
    emitLocalSnapshot();
    return;
  }

  await Promise.all(cleanEmployees.map((employee) => setDoc(doc(db, "employees", employee.id), employee)));

  const recordsSnapshot = await getDocs(collection(db, "records"));
  await Promise.all(recordsSnapshot.docs.map((item) => deleteDoc(doc(db, "records", item.id))));
}

export async function addRecord(record) {
  if (!firebaseReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, [{ ...record, id: `local-${Date.now()}` }, ...current]);
    emitLocalSnapshot();
    return;
  }
  await addDoc(collection(db, "records"), { ...record, createdAt: serverTimestamp() });
}

export async function saveEmployee(employee) {
  if (baseEmployeeIds.has(employee.id)) {
    const deletedEmployeeIds = loadDeletedEmployeeIds();
    deletedEmployeeIds.delete(employee.id);
    saveDeletedEmployeeIds(deletedEmployeeIds);
  }

  if (!firebaseReady || !db) {
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
  await setDoc(doc(db, "employees", employee.id), employee, { merge: true });
}

export async function removeEmployee(employeeId) {
  if (baseEmployeeIds.has(employeeId)) {
    const deletedEmployeeIds = loadDeletedEmployeeIds();
    deletedEmployeeIds.add(employeeId);
    saveDeletedEmployeeIds(deletedEmployeeIds);
  }
  if (!firebaseReady || !db) {
    const current = protectEmployeeList(loadLocal(EMPLOYEE_KEY, initialEmployees));
    saveLocal(EMPLOYEE_BACKUP_KEY, {
      savedAt: Date.now(),
      employees: current
    });
    saveLocal(EMPLOYEE_KEY, current.filter((item) => item.id !== employeeId));
    emitLocalSnapshot();
    return;
  }
  await deleteDoc(doc(db, "employees", employeeId));
}

export async function updateRecord(recordId, patch) {
  if (!firebaseReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, current.map((item) => (item.id === recordId ? { ...item, ...patch } : item)));
    emitLocalSnapshot();
    return;
  }
  await updateDoc(doc(db, "records", recordId), patch);
}

export async function removeRecordsByEmployeeDate(employeeId, date) {
  if (!firebaseReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, current.filter((item) => !(item.employeeId === employeeId && item.date === date)));
    emitLocalSnapshot();
    return;
  }

  const snapshot = await getDocs(query(collection(db, "records")));
  const targets = snapshot.docs.filter((item) => {
    const data = item.data();
    return data.employeeId === employeeId && data.date === date;
  });
  await Promise.all(targets.map((item) => deleteDoc(doc(db, "records", item.id))));
}
