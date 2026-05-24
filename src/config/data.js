export const indicatorLabels = {
  validAccount: "有效户",
  newAsset: "新增资产",
  investSign: "投顾签约",
  twoMarginValid: "两融有效户",
  productSales: "产品销售额",
  twoMarginNew: "新开两融",
  extraT0: "积分"
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
  "有效户：日报按有效户+空户折算统计；10个空户折算1个有效户，月度空户折算最多计2户，单项得分上限100%。",
  "新增资产：按月度目标统计，单项得分上限150%。",
  "投顾签约：新增客户投顾签约产品；全账户提佣、ETF投顾组合计2户，产生跟单计3户，单项得分上限150%。",
  "两融有效户：存量两融激活或新增两融有效户，单项得分上限150%。",
  "产品销售额：私募按1.5系数，公募按1系数，收凭按0.8系数计算；日报展示折算后销售额，月度累加折算后销售额，单项得分上限150%。",
  "新开两融：新人组统计新开两融户，单项得分上限100%。",
  "积分：当日有效户每新增1户加5分；月度产品销售额达到300万元加5分；综合完成率组内首位/末位按规则奖惩。"
];

export const emptyTargets = {
  validAccount: 0,
  newAsset: 0,
  investSign: 0,
  twoMarginValid: 0,
  productSales: 0,
  twoMarginNew: 0
};

export const initialEmployees = [
  { id: "e1", name: "汪洋", group: "老人组", targets: { ...emptyTargets } },
  { id: "e2", name: "涂雪娇", group: "老人组", targets: { ...emptyTargets } },
  { id: "e3", name: "简金平", group: "老人组", targets: { ...emptyTargets } },
  { id: "e4", name: "胡文贵", group: "老人组", targets: { ...emptyTargets } },
  { id: "e5", name: "张小雪", group: "老人组", targets: { ...emptyTargets } },
  { id: "e6", name: "曹忠", group: "老人组", targets: { ...emptyTargets } },
  { id: "e7", name: "曾印名", group: "老人组", targets: { ...emptyTargets } },
  { id: "e8", name: "付颖", group: "老人组", targets: { ...emptyTargets } },
  { id: "e9", name: "唐传得", group: "新人组", targets: { ...emptyTargets } },
  { id: "e10", name: "龙玮丹", group: "新人组", targets: { ...emptyTargets } },
  { id: "e11", name: "邓皓悦", group: "新人组", targets: { ...emptyTargets } },
  { id: "e12", name: "陈菲", group: "新人组", targets: { ...emptyTargets } }
];

export function initialRecords() {
  return [];
}
