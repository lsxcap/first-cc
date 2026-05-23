import { indicatorLabels, upperLimit, weights } from "../config/data.js";

export const RULES = {
  productSalesCoefficients: {
    privateFund: 1.5,
    publicFund: 1,
    receipt: 0.8
  },
  emptyToValid: 10,
  maxMonthlyEmptyConvert: 2,
  newAccountScore: 5,
  monthlySalesThreshold: 300,
  monthlySalesReward: 5
};

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

function toNumber(value) {
  return Number(value || 0);
}

export function calculateProductSales({ privateFund = 0, publicFund = 0, receipt = 0 }) {
  return (
    toNumber(privateFund) * RULES.productSalesCoefficients.privateFund +
    toNumber(publicFund) * RULES.productSalesCoefficients.publicFund +
    toNumber(receipt) * RULES.productSalesCoefficients.receipt
  );
}

export function calculateDailyEffective({ validAccounts = 0, emptyAccounts = 0 }) {
  const valid = toNumber(validAccounts);
  const empty = toNumber(emptyAccounts);
  const convertedFromEmpty = Math.floor(empty / RULES.emptyToValid);
  return {
    validAccounts: valid,
    emptyAccounts: empty,
    convertedFromEmpty,
    dailyEffective: valid + convertedFromEmpty
  };
}

function getRawValidAccounts(record) {
  if (record.rawValue !== undefined) return toNumber(record.rawValue);
  if (record.validAccounts !== undefined) return toNumber(record.validAccounts);
  return toNumber(record.value);
}

function getConvertedFromEmpty(record) {
  return toNumber(record.convertedFromEmpty);
}

export function summarizeDay(records, employees, date) {
  const employeeMap = buildEmployeeMap(employees);
  const dayRecords = records.filter((record) => record.date === date);
  const byIndicator = {};
  const byEmployee = {};
  let dailyRulePoints = 0;

  for (const record of dayRecords) {
    byIndicator[record.indicator] = (byIndicator[record.indicator] || 0) + Number(record.value || 0);
    byEmployee[record.employeeId] = (byEmployee[record.employeeId] || 0) + Number(record.value || 0);
    if (record.indicator === "validAccount") {
      dailyRulePoints += Number(record.value || 0) * RULES.newAccountScore;
    }
  }
  byIndicator.extraT0 = (byIndicator.extraT0 || 0) + dailyRulePoints;

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
    let rawValidAccounts = 0;
    let emptyConvertedAccounts = 0;
    let dailyNewAccountPoints = 0;

    for (const record of monthlyRecords) {
      if (record.indicator === "extraT0") {
        actuals.extraPoints += Number(record.extraPoints || 0);
      } else if (record.indicator === "validAccount") {
        rawValidAccounts += getRawValidAccounts(record);
        emptyConvertedAccounts += getConvertedFromEmpty(record);
        dailyNewAccountPoints += toNumber(record.value) * RULES.newAccountScore;
      } else if (actuals[record.indicator] !== undefined) {
        actuals[record.indicator] += Number(record.value || 0);
      }
    }
    actuals.validAccount = rawValidAccounts + Math.min(emptyConvertedAccounts, RULES.maxMonthlyEmptyConvert);

    const monthlySalesReward = actuals.productSales >= RULES.monthlySalesThreshold ? RULES.monthlySalesReward : 0;
    const rulePoints = dailyNewAccountPoints + monthlySalesReward;
    actuals.extraPoints += rulePoints;

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
      finalPoints: actuals.extraPoints,
      rewardBreakdown: {
        dailyNewAccountPoints,
        monthlySalesReward,
        rulePoints
      }
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
