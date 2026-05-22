import { indicatorLabels, upperLimit, weights } from "../config/data.js";

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function monthString(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return "0";
  const rounded = Number(value).toFixed(digits);
  return rounded.replace(/\.0$/, "");
}

export function buildEmployeeMap(employees) {
  return Object.fromEntries(employees.map((employee) => [employee.id, employee]));
}

export function summarizeDay(records, employees, date) {
  const employeeMap = buildEmployeeMap(employees);
  const dayRecords = records.filter((record) => record.date === date);
  const byIndicator = {};
  const byEmployee = {};

  for (const record of dayRecords) {
    byIndicator[record.indicator] = (byIndicator[record.indicator] || 0) + Number(record.value || 0);
    byEmployee[record.employeeId] = (byEmployee[record.employeeId] || 0) + Number(record.value || 0);
  }

  return {
    records: dayRecords,
    byIndicator,
    byEmployee,
    filledEmployeeIds: new Set(dayRecords.map((record) => record.employeeId)),
    employeeMap
  };
}

export function computeMonthlyStats(records, employees, yearMonth) {
  return employees.map((employee) => {
    const monthlyRecords = records.filter((record) => record.employeeId === employee.id && record.date?.startsWith(yearMonth));
    const actuals = {
      validAccount: 0,
      newAsset: 0,
      investSign: 0,
      twoMarginValid: 0,
      productSales: 0,
      twoMarginNew: 0,
      extraPoints: 0
    };

    for (const record of monthlyRecords) {
      if (record.indicator === "extraT0") {
        actuals.extraPoints += Number(record.extraPoints || 0);
      } else if (actuals[record.indicator] !== undefined) {
        actuals[record.indicator] += Number(record.value || 0);
      }
    }

    const rates = {};
    const groupWeights = weights[employee.group] || {};
    for (const indicator of Object.keys(groupWeights)) {
      const target = Number(employee.targets?.[indicator] || 0);
      rates[indicator] = target > 0 ? Math.min(actuals[indicator] / target, upperLimit[indicator] || 1) : 0;
    }

    const overall = Object.entries(groupWeights).reduce((sum, [indicator, weight]) => sum + (rates[indicator] || 0) * weight, 0);
    return {
      employee,
      actuals,
      rates,
      overall,
      extraPoints: actuals.extraPoints,
      finalPoints: actuals.extraPoints
    };
  });
}

export function withRewardPoints(stats) {
  const next = stats.map((item) => ({ ...item }));
  for (const groupName of ["老人组", "新人组"]) {
    const group = next.filter((item) => item.employee.group === groupName);
    if (!group.length) continue;
    const max = Math.max(...group.map((item) => item.overall));
    const min = Math.min(...group.map((item) => item.overall));
    for (const item of group) {
      if (item.overall === max && max >= 0.8) item.finalPoints += 2;
      if (item.overall === min && min < 0.5) item.finalPoints -= 2;
    }
  }
  return next;
}

export function indicatorRowsFor(employee) {
  const groupWeights = weights[employee.group] || {};
  return Object.keys(groupWeights).map((indicator) => ({
    key: indicator,
    label: indicatorLabels[indicator],
    target: employee.targets?.[indicator] || 0
  }));
}
