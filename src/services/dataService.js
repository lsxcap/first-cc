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
import { initialEmployees, initialRecords } from "../config/data.js";

const STORAGE_VERSION = "v2";
const EMPLOYEE_KEY = `juan_workbench_employees_${STORAGE_VERSION}`;
const EMPLOYEE_BACKUP_KEY = `juan_workbench_employees_backup_${STORAGE_VERSION}`;
const RECORD_KEY = `juan_workbench_records_${STORAGE_VERSION}`;

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
      employees = snapshot.empty ? initialEmployees : snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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

export async function seedInitialData() {
  if (!firebaseReady || !db) {
    saveLocal(EMPLOYEE_KEY, initialEmployees);
    saveLocal(RECORD_KEY, initialRecords());
    emitLocalSnapshot();
    return;
  }

  const employeesSnapshot = await getDocs(collection(db, "employees"));
  if (employeesSnapshot.empty) {
    await Promise.all(initialEmployees.map((employee) => setDoc(doc(db, "employees", employee.id), employee)));
  }

  const recordsSnapshot = await getDocs(collection(db, "records"));
  if (recordsSnapshot.empty) {
    await Promise.all(initialRecords().map((record) => setDoc(doc(db, "records", record.id), record)));
  }
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
  if (!firebaseReady || !db) {
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
    return;
  }
  await setDoc(doc(db, "employees", employee.id), employee, { merge: true });
}

export async function removeEmployee(employeeId) {
  if (!firebaseReady || !db) {
    const current = loadLocal(EMPLOYEE_KEY, initialEmployees);
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
