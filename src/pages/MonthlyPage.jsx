import { useEffect, useState } from "react";
import { indicatorLabels, monthlyRules } from "../config/data.js";
import { computeMonthlyStats, formatNumber, monthString, withRewardPoints } from "../utils/metrics.js";

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
}

function downloadMonthlyDetail(stats, selectedMonth) {
  const groups = ["老人组", "新人组"];
  const headers = ["组别", "姓名", "综合", "有效户目标", "有效户实际", "有效户完成率", "新增资产目标", "新增资产实际", "新增资产完成率", "投顾目标", "投顾实际", "投顾完成率", "两融/新开目标", "两融/新开实际", "两融/新开完成率", "产品目标", "产品实际", "产品完成率", "奖惩分"];
  const metricKeysFor = (group) => ["validAccount", "newAsset", "investSign", group === "新人组" ? "twoMarginNew" : "twoMarginValid", "productSales"];
  const formatRate = (rate) => `${formatNumber((rate || 0) * 100)}%`;
  const formatPoints = (points) => points > 0 ? `+${formatNumber(points)}` : formatNumber(points);
  const rows = groups.flatMap((group) => {
    const groupRows = stats.filter((item) => item.employee.group === group);
    const metricKeys = metricKeysFor(group);
    const detailRows = groupRows.map((item) => [
      group,
      item.employee.name,
      formatRate(item.overall),
      ...metricKeys.flatMap((key) => [
        formatNumber(item.employee.targets[key]),
        formatNumber(item.actuals[key]),
        formatRate(item.rates[key])
      ]),
      formatPoints(item.finalPoints)
    ]);
    if (!groupRows.length) return detailRows;

    const totals = metricKeys.map((key) => {
      const target = groupRows.reduce((sum, item) => sum + Number(item.employee.targets[key] || 0), 0);
      const actual = groupRows.reduce((sum, item) => sum + Number(item.actuals[key] || 0), 0);
      return [formatNumber(target), formatNumber(actual), formatRate(target > 0 ? actual / target : 0)];
    });
    const averageOverall = groupRows.reduce((sum, item) => sum + item.overall, 0) / groupRows.length;
    const totalPoints = groupRows.reduce((sum, item) => sum + Number(item.finalPoints || 0), 0);

    return [
      ...detailRows,
      [
        group,
        "合计",
        formatRate(averageOverall),
        ...totals.flat(),
        formatPoints(totalPoints)
      ]
    ];
  });
  return downloadCsv(`${selectedMonth}-个人明细.csv`, headers, rows);
}

function MonthlyRulePanel() {
  return (
    <details className="panel rules-panel">
      <summary>月度规则归纳</summary>
      <div className="rule-grid">
        {monthlyRules.map((rule, index) => (
          <div className="rule-card" key={rule}>
            <span>{index + 1}</span>
            <p>{rule}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

function DetailGroupTable({ group, stats }) {
  const rows = stats.filter((item) => item.employee.group === group);
  const marginKey = group === "新人组" ? "twoMarginNew" : "twoMarginValid";
  const columns = ["validAccount", "newAsset", "investSign", marginKey, "productSales"];
  const totals = columns.reduce((acc, key) => {
    const target = rows.reduce((sum, item) => sum + Number(item.employee.targets[key] || 0), 0);
    const actual = rows.reduce((sum, item) => sum + Number(item.actuals[key] || 0), 0);
    acc[key] = {
      target,
      actual,
      rate: target > 0 ? actual / target : 0
    };
    return acc;
  }, {});
  const averageOverall = rows.reduce((sum, item) => sum + item.overall, 0) / Math.max(1, rows.length);
  const totalPoints = rows.reduce((sum, item) => sum + Number(item.finalPoints || 0), 0);
  if (!rows.length) return null;

  return (
    <section className="detail-group">
      <div className="detail-group-title">
        <strong>{group}</strong>
        <span>{rows.length}人</span>
      </div>
      <div className="table-scroll">
        <table className="score-table">
          <thead>
            <tr>
              <th rowSpan="2" className="sticky-name">姓名</th>
              <th rowSpan="2">综合</th>
              {columns.map((key) => <th colSpan="3" key={key}>{indicatorLabels[key]}</th>)}
              <th rowSpan="2">奖惩分</th>
            </tr>
            <tr>
              {columns.map((key) => (
                <FragmentHeaders key={key} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.employee.id}>
                <td className="sticky-name">{item.employee.name}</td>
                <td><strong>{formatNumber(item.overall * 100)}%</strong></td>
                {columns.map((key) => {
                  const target = item.employee.targets[key] || 0;
                  const actual = item.actuals[key] || 0;
                  const rate = item.rates[key] || 0;
                  return (
                    <FragmentCells
                      key={key}
                      target={target}
                      actual={actual}
                      rate={rate}
                    />
                  );
                })}
                <td>{item.finalPoints > 0 ? `+${item.finalPoints}` : item.finalPoints}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky-name">合计</td>
              <td><strong>{formatNumber(averageOverall * 100)}%</strong></td>
              {columns.map((key) => (
                <FragmentCells
                  key={key}
                  target={totals[key].target}
                  actual={totals[key].actual}
                  rate={totals[key].rate}
                />
              ))}
              <td>{totalPoints > 0 ? `+${formatNumber(totalPoints)}` : formatNumber(totalPoints)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function FragmentHeaders() {
  return (
    <>
      <th>指标</th>
      <th>实际</th>
      <th>完成率</th>
    </>
  );
}

function FragmentCells({ target, actual, rate }) {
  return (
    <>
      <td>{formatNumber(target)}</td>
      <td>{formatNumber(actual)}</td>
      <td>{formatNumber(rate * 100)}%</td>
    </>
  );
}

function PointsRaceBoard({ stats }) {
  const positiveRows = [...stats].filter((item) => item.finalPoints > 0).sort((a, b) => {
    if (b.finalPoints !== a.finalPoints) return b.finalPoints - a.finalPoints;
    return b.overall - a.overall;
  }).slice(0, 3);
  const negativeRows = [...stats].filter((item) => item.finalPoints < 0).sort((a, b) => {
    if (a.finalPoints !== b.finalPoints) return a.finalPoints - b.finalPoints;
    return a.overall - b.overall;
  }).slice(0, 3);
  const maxPositive = Math.max(1, ...positiveRows.map((item) => item.finalPoints));
  const maxNegative = Math.max(1, ...negativeRows.map((item) => Math.abs(item.finalPoints)));

  return (
    <section className="panel points-panel">
      <div className="panel-title">
        <h2>积分赛道榜</h2>
      </div>
      <div className="points-lanes">
        <PointLane title="正向积分" rows={positiveRows} maxPoint={maxPositive} tone="positive" emptyText="暂无加分记录" />
        <PointLane title="扣分提醒" rows={negativeRows} maxPoint={maxNegative} tone="negative" emptyText="暂无扣分记录" />
      </div>
      <p className="points-note">正向积分展示奖励与额外加分，扣分提醒展示组内末位等扣分项。</p>
    </section>
  );
}

function PointLane({ title, rows, maxPoint, tone, emptyText }) {
  return (
    <div className={`points-lane ${tone}`}>
      <h3>{title}</h3>
      <div className="points-list">
        {rows.length === 0 && <div className="points-empty">{emptyText}</div>}
        {rows.map((item, index) => {
          const rewardDelta = item.finalPoints - item.extraPoints;
          const absPoint = Math.abs(item.finalPoints);
          const width = `${absPoint / maxPoint * 100}%`;
          return (
            <div className="points-row" key={item.employee.id}>
              <div className={`points-medal points-${index + 1}`}>{index + 1}</div>
              <div className="points-main">
                <div className="points-line">
                  <div className="points-person">
                    <strong>{item.employee.name}</strong>
                    <span>{item.employee.group}</span>
                  </div>
                  <div className="points-score">{formatNumber(item.finalPoints)} 分</div>
                </div>
                <div className="points-badges">
                  {rewardDelta > 0 && <b className="reward">奖 +{rewardDelta}</b>}
                  {rewardDelta < 0 && <b className="penalty">罚 {rewardDelta}</b>}
                  {item.extraPoints > 0 && <b className="extra">额外 +{item.extraPoints}</b>}
                </div>
                <div className="points-track">
                  <div style={{ width }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MonthlyPage({ employees, records }) {
  const [selectedMonth, setSelectedMonth] = useState(monthString());
  const [downloadInfo, setDownloadInfo] = useState(null);
  const stats = withRewardPoints(computeMonthlyStats(records, employees, selectedMonth));
  const sorted = [...stats].sort((a, b) => b.overall - a.overall);
  const oldAvg = stats.filter((item) => item.employee.group === "老人组").reduce((sum, item) => sum + item.overall, 0) / Math.max(1, stats.filter((item) => item.employee.group === "老人组").length);
  const newAvg = stats.filter((item) => item.employee.group === "新人组").reduce((sum, item) => sum + item.overall, 0) / Math.max(1, stats.filter((item) => item.employee.group === "新人组").length);
  const podium = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  useEffect(() => () => {
    if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
  }, [downloadInfo]);

  return (
    <div className="dashboard-grid">
      <section className="panel monthly-overview">
        <div className="dashboard-title">
          <input className="date-compact" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          <p className="eyebrow">月报视图</p>
          <h2>{selectedMonth} 完成率</h2>
        </div>
        <div className="monthly-overview-grid">
          <div className="metric-grid two compact-average">
            <div className="metric-card accent"><span>老人组平均</span><strong>{formatNumber(oldAvg * 100)}%</strong></div>
            <div className="metric-card green"><span>新人组平均</span><strong>{formatNumber(newAvg * 100)}%</strong></div>
          </div>
          <div className="compact-rank">
            <h3>完成率排行</h3>
            <div className="podium-list compact-podium">
              {podium.map((item) => {
                const place = sorted.findIndex((stat) => stat.employee.id === item.employee.id) + 1;
                return (
                  <div className={`podium-card podium-${place}`} key={item.employee.id}>
                    <div className="rank-medal">{place}</div>
                    <div className="rank-person">
                      <strong>{item.employee.name}</strong>
                      <span>{item.employee.group}</span>
                    </div>
                    <div className="rank-score">{formatNumber(item.overall * 100)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      <PointsRaceBoard stats={stats} />
      <section className="panel table-panel">
        <div className="panel-title">
          <h2>个人明细</h2>
          <div className="panel-actions">
            {downloadInfo && (
              <a className="export-link" href={downloadInfo.url} download={downloadInfo.filename} target="_blank" rel="noreferrer">
                表格已生成，点击打开
              </a>
            )}
            <button
              className="ghost"
              onClick={() => {
                if (downloadInfo?.url) URL.revokeObjectURL(downloadInfo.url);
                setDownloadInfo(downloadMonthlyDetail(sorted, selectedMonth));
              }}
            >
              下载表格
            </button>
          </div>
        </div>
        <div className="detail-groups">
          <DetailGroupTable group="老人组" stats={sorted} />
          <DetailGroupTable group="新人组" stats={sorted} />
        </div>
      </section>
      <MonthlyRulePanel />
    </div>
  );
}
