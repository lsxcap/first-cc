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
import { db, firebaseReady } from "./firebase.js";
import { initialEmployees, initialRecords } from "./data.js";

const EMPLOYEE_KEY = "juan_workbench_employees";
const RECORD_KEY = "juan_workbench_records";

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

export function loadLocalSnapshot() {
  return {
    employees: loadLocal(EMPLOYEE_KEY, initialEmployees),
    records: loadLocal(RECORD_KEY, initialRecords())
  };
}

export function subscribeData(onData, onError) {
  if (!firebaseReady || !db) {
    onData(loadLocalSnapshot());
    return () => {};
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
    return;
  }
  await addDoc(collection(db, "records"), { ...record, createdAt: serverTimestamp() });
}

export async function saveEmployee(employee) {
  if (!firebaseReady || !db) {
    const current = loadLocal(EMPLOYEE_KEY, initialEmployees);
    const exists = current.some((item) => item.id === employee.id);
    const next = exists ? current.map((item) => (item.id === employee.id ? employee : item)) : [...current, employee];
    saveLocal(EMPLOYEE_KEY, next);
    return;
  }
  await setDoc(doc(db, "employees", employee.id), employee, { merge: true });
}

export async function removeEmployee(employeeId) {
  if (!firebaseReady || !db) {
    const current = loadLocal(EMPLOYEE_KEY, initialEmployees);
    saveLocal(EMPLOYEE_KEY, current.filter((item) => item.id !== employeeId));
    return;
  }
  await deleteDoc(doc(db, "employees", employeeId));
}

export async function updateRecord(recordId, patch) {
  if (!firebaseReady || !db) {
    const current = loadLocal(RECORD_KEY, initialRecords());
    saveLocal(RECORD_KEY, current.map((item) => (item.id === recordId ? { ...item, ...patch } : item)));
    return;
  }
  await updateDoc(doc(db, "records", recordId), patch);
}
