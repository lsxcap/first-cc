export const indicatorLabels = {
  validAccount: "有效户",
  newAsset: "新增资产",
  investSign: "投顾签约",
  twoMarginValid: "两融有效户",
  productSales: "产品销售额",
  twoMarginNew: "新开两融",
  extraT0: "额外加分"
};

export const indicatorUnits = {
  validAccount: "户",
  newAsset: "万元",
  investSign: "户",
  twoMarginValid: "户",
  productSales: "万元",
  twoMarginNew: "户",
  extraT0: "分"
};

export const weights = {
  老人组: { validAccount: 0.2, newAsset: 0.2, investSign: 0.15, twoMarginValid: 0.25, productSales: 0.2 },
  新人组: { validAccount: 0.25, newAsset: 0.25, investSign: 0.2, productSales: 0.2, twoMarginNew: 0.1 }
};

export const upperLimit = {
  validAccount: 1,
  newAsset: 1.5,
  investSign: 1.5,
  twoMarginValid: 1.5,
  productSales: 1.5,
  twoMarginNew: 1
};

export const monthlyRules = [
  "综合完成率各组首位且达到80%，奖励2分；各组末位且低于50%，扣2分。",
  "有效户：10个空户视同1个有效户，单项得分上限100%。",
  "新增资产：按月度目标统计，单项得分上限150%。",
  "投顾签约：新增客户投顾签约产品；全账户提佣、ETF投顾组合计2户，产生跟单计3户，单项得分上限150%。",
  "两融有效户：存量两融激活或新增两融有效户，单项得分上限150%。",
  "产品销售额：私募及重点公募按1.5系数，其余公募按1系数，收凭按0.8系数计算，单项得分上限150%。",
  "新开两融：新人组统计新开两融户，单项得分上限100%。",
  "额外加分：T0新开户加5分；产生300万成交量再加5分。"
];

export const initialEmployees = [
  { id: "e1", name: "汪洋", group: "老人组", targets: { validAccount: 7, newAsset: 130, investSign: 9, twoMarginValid: 1, productSales: 100, twoMarginNew: 0 } },
  { id: "e2", name: "涂雪娇", group: "老人组", targets: { validAccount: 7, newAsset: 130, investSign: 9, twoMarginValid: 1, productSales: 100, twoMarginNew: 0 } },
  { id: "e3", name: "简金平", group: "老人组", targets: { validAccount: 7, newAsset: 140, investSign: 9, twoMarginValid: 1, productSales: 100, twoMarginNew: 0 } },
  { id: "e4", name: "胡文贵", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } },
  { id: "e5", name: "张小雪", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } },
  { id: "e6", name: "曹忠", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } },
  { id: "e7", name: "曾印名", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } },
  { id: "e8", name: "付颖", group: "老人组", targets: { validAccount: 7, newAsset: 100, investSign: 7, twoMarginValid: 1, productSales: 70, twoMarginNew: 0 } },
  { id: "e9", name: "唐传得", group: "新人组", targets: { validAccount: 7, newAsset: 120, investSign: 5, productSales: 20, twoMarginNew: 1, twoMarginValid: 0 } },
  { id: "e10", name: "龙玮丹", group: "新人组", targets: { validAccount: 7, newAsset: 100, investSign: 5, productSales: 20, twoMarginNew: 1, twoMarginValid: 0 } },
  { id: "e11", name: "邓皓悦", group: "新人组", targets: { validAccount: 7, newAsset: 100, investSign: 5, productSales: 20, twoMarginNew: 1, twoMarginValid: 0 } },
  { id: "e12", name: "陈菲", group: "新人组", targets: { validAccount: 7, newAsset: 100, investSign: 5, productSales: 20, twoMarginNew: 1, twoMarginValid: 0 } }
];

export function initialRecords() {
  const mayDate = "2026-05-31";
  const mayActuals = {
    涂雪娇: { validAccount: 6, newAsset: 84.8, investSign: 2, productSales: 203 },
    汪洋: { validAccount: 4, newAsset: 19.3, investSign: 1, productSales: 29.7 },
    胡文贵: { validAccount: 6, newAsset: 205, investSign: 4, twoMarginValid: 1, productSales: 25.3 },
    简金平: { validAccount: 5, newAsset: 20.2, investSign: 4, twoMarginValid: 1, productSales: 117.15 },
    张小雪: { validAccount: 7, newAsset: 157, investSign: 1 },
    曹忠: { validAccount: 4, newAsset: 9.1, investSign: 21, productSales: 6.3 },
    曾印名: { validAccount: 3, newAsset: 3.1, investSign: 7, productSales: 5 },
    付颖: { validAccount: 2, newAsset: 10, investSign: 2, productSales: 7 },
    唐传得: { validAccount: 1, newAsset: 26, productSales: 1 },
    龙玮丹: { validAccount: 1, newAsset: 11, productSales: 1.5 },
    邓皓悦: { productSales: 92 },
    陈菲: { validAccount: 4, newAsset: 143 }
  };

  const records = [];
  for (const employee of initialEmployees) {
    const actuals = mayActuals[employee.name];
    if (!actuals) continue;
    for (const [indicator, value] of Object.entries(actuals)) {
      if (!value) continue;
      records.push({
        id: `seed-${employee.id}-${indicator}`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: mayDate,
        indicator,
        value,
        extraPoints: 0,
        note: "2026年5月样例数据"
      });
    }
  }

  [
    ["e1", "validAccount", 2],
    ["e2", "newAsset", 55],
    ["e3", "investSign", 1],
    ["e4", "productSales", 30],
    ["e5", "twoMarginValid", 1]
  ].forEach(([employeeId, indicator, value], index) => {
    const employee = initialEmployees.find((item) => item.id === employeeId);
    records.push({
      id: `demo-20260519-${index}`,
      employeeId,
      employeeName: employee?.name || "",
      date: "2026-05-19",
      indicator,
      value,
      extraPoints: 0,
      note: "日报演示数据"
    });
  });

  return records;
}
