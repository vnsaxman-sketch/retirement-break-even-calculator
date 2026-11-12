import { useMemo, useState } from "react";
import "./index.css";

type Inputs = {
  age: number;
  lifeExpectancy: number;
  homeEquity: number;
  stocks: number;
  ssaMonthly: number;
  compareSsaMonthly: number;
  annualSpending: number;
  stockReturn: number;
  homeGrowth: number;
  discountRate: number;
  poorSsaAnnual: number;
  poorBenefitsAnnual: number;
  poorAssets: number;
  homeLimit: number;
  nursingCostAnnual: number;
};

const DEFAULTS: Inputs = {
  age: 62,
  lifeExpectancy: 85,
  homeEquity: 900000,
  stocks: 350000,
  ssaMonthly: 2089,
  compareSsaMonthly: 1253,
  annualSpending: 73000,
  stockReturn: 5,
  homeGrowth: 4,
  discountRate: 3,
  poorSsaAnnual: 12000,
  poorBenefitsAnnual: 30000,
  poorAssets: 1500,
  homeLimit: 730000,
  nursingCostAnnual: 130000,
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtNum = (n: number, d = 2) => n.toLocaleString("en-US", { maximumFractionDigits: d });

function Field(props: { label: string; value: number; onChange: (v: number) => void; hint?: string; prefix?: string; suffix?: string }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <div className="input-wrap">
        {props.prefix ? <span className="affix">{props.prefix}</span> : null}
        <input type="number" value={props.value} onChange={(e) => props.onChange(Number(e.target.value) || 0)} />
        {props.suffix ? <span className="affix">{props.suffix}</span> : null}
      </div>
      {props.hint ? <span className="hint">{props.hint}</span> : null}
    </label>
  );
}

function solveForSsa(inp: Inputs, ssaMonthly: number) {
  const r = inp.stockReturn / 100;
  const S_you = ssaMonthly * 12;
  const D = inp.annualSpending - S_you;
  const years = Math.max(0, inp.lifeExpectancy - inp.age);
  const dRate = inp.discountRate / 100;
  const A = dRate === 0 ? years : (1 - Math.exp(-dRate * years)) / dRate;
  const W_star = inp.poorAssets + (inp.poorSsaAnnual + inp.poorBenefitsAnnual - S_you) * A;
  const gap = inp.stocks - W_star;
  let depletionAge: number | null = null;
  let sustainable = false;
  if (D <= 0) sustainable = true;
  else if (r === 0) depletionAge = inp.age + inp.stocks / D;
  else {
    const Dr = D / r;
    if (Dr <= inp.stocks) sustainable = true;
    else depletionAge = inp.age + Math.log(Dr / (Dr - inp.stocks)) / r;
  }
  return { S_you, D, A, W_star, gap, depletionAge, sustainable };
}

export default function App() {
  const [inp, setInp] = useState<Inputs>({ ...DEFAULTS });
  const [resetKey, setResetKey] = useState(0);
  const set = (k: keyof Inputs) => (v: number) => setInp((p) => ({ ...p, [k]: v }));

  const handleReset = () => {
    setInp({ ...DEFAULTS });
    setResetKey((k) => k + 1);
  };

  const calc = useMemo(() => {
    const r = inp.stockReturn / 100;
    const g = inp.homeGrowth / 100;
    const cur = solveForSsa(inp, inp.ssaMonthly);
    const cmp = solveForSsa(inp, inp.compareSsaMonthly);
    const W_total = inp.homeEquity + inp.stocks;
    const excess = Math.max(0, inp.homeEquity - inp.homeLimit);
    const S_star_annual = inp.poorSsaAnnual + inp.poorBenefitsAnnual - (inp.stocks - inp.poorAssets) / cur.A;
    const S_star_monthly = S_star_annual / 12;
    const stocksAt = (age: number) => {
      const dt = age - inp.age;
      if (r === 0) return Math.max(0, inp.stocks - cur.D * dt);
      return Math.max(0, (inp.stocks - cur.D / r) * Math.exp(r * dt) + cur.D / r);
    };
    const homeAt = (age: number) => inp.homeEquity * Math.exp(g * (age - inp.age));
    const projection: Array<{ age: number; stocks: number; home: number; total: number }> = [];
    for (let a = inp.age; a <= inp.lifeExpectancy; a++) {
      const s = stocksAt(a);
      const h = homeAt(a);
      projection.push({ age: a, stocks: s, home: h, total: s + h });
    }
    const care = [1, 3, 5].map((yrs) => {
      const cost = yrs * inp.nursingCostAnnual;
      return { yrs, cost, fromHome: Math.max(0, cost - inp.stocks) };
    });
    return { r, g, cur, cmp, W_total, excess, S_star_annual, S_star_monthly, projection, care };
  }, [inp]);

  const equations: string[] = [
    `W_total = ${fmt(calc.W_total)}`,
    `E = max(0, Home - Limit) = ${fmt(calc.excess)}`,
    `S_you = SSA x 12 = ${fmt(calc.cur.S_you)}`,
    `D = Spending - S_you = ${fmt(calc.cur.D)}`,
    `W_stocks(t) = (Stocks - D/r)*e^(r*(t-age)) + D/r`,
    `A = (1 - e^(-d*T))/d = ${fmtNum(calc.cur.A, 2)}`,
    `W* = PoorAssets + (PoorSSA + Bmax - S_you)*A = ${fmt(calc.cur.W_star)}`,
    `Gap = Stocks - W* = ${fmt(calc.cur.gap)}`,
    `S* threshold annual = PoorSSA + Bmax - (Stocks - PoorAssets)/A = ${fmt(calc.S_star_annual)}`,
    `S* threshold monthly = ${fmt(calc.S_star_monthly)} / mo`,
  ];

  const maxProj = Math.max(...calc.projection.map((p) => p.total), 1);
  const status = calc.cur.gap > 500 ? "ABOVE - You Win" : calc.cur.gap < -500 ? "BELOW - Poor Retiree Wins" : "AT THRESHOLD - Tie";

  return (
    <div className="page">
      <header className="header">
        <h1>Retirement Wealth Break-Even Calculator</h1>
        <p>Change SSA to find the threshold - California Medi-Cal rules</p>	
	<br/>
	<p>Developed by: Long Nguyen</p>
      </header>
      <main className="layout">
        <section className="panel inputs" key={resetKey}>
          <h2>Your Inputs</h2>
          <h3>Your Wealth</h3>
          <Field label="Current Age" value={inp.age} onChange={set("age")} />
          <Field label="Life Expectancy" value={inp.lifeExpectancy} onChange={set("lifeExpectancy")} />
          <Field label="Home Equity" value={inp.homeEquity} onChange={set("homeEquity")} prefix="$" />
          <Field label="Stocks / Liquid Savings" value={inp.stocks} onChange={set("stocks")} prefix="$" />
          <h3>SSA - Change This To Test</h3>
          <Field label="SSA Monthly - Current" value={inp.ssaMonthly} onChange={set("ssaMonthly")} prefix="$" hint="Try 1253, 1751, 2089" />
          <Field label="SSA Monthly - Compare To" value={inp.compareSsaMonthly} onChange={set("compareSsaMonthly")} prefix="$" hint="e.g. 1253 to compare vs current" />
          <Field label="Annual Total Spending" value={inp.annualSpending} onChange={set("annualSpending")} prefix="$" />
          <h3>Assumptions</h3>
          <Field label="Stock Return r" value={inp.stockReturn} onChange={set("stockReturn")} suffix="%" />
          <Field label="Home Growth g" value={inp.homeGrowth} onChange={set("homeGrowth")} suffix="%" />
          <Field label="Discount Rate" value={inp.discountRate} onChange={set("discountRate")} suffix="%" />
          <h3>Comparison: Low-Asset Retiree</h3>
          <Field label="Poor Retiree SSA Annual" value={inp.poorSsaAnnual} onChange={set("poorSsaAnnual")} prefix="$" />
          <Field label="Poor Retiree Benefits Bmax Annual" value={inp.poorBenefitsAnnual} onChange={set("poorBenefitsAnnual")} prefix="$" />
          <Field label="Poor Retiree Starting Assets" value={inp.poorAssets} onChange={set("poorAssets")} prefix="$" />
          <h3>Care Costs</h3>
          <Field label="CA Home Equity Limit (LTC)" value={inp.homeLimit} onChange={set("homeLimit")} prefix="$" />
          <Field label="Nursing Home Cost / Year" value={inp.nursingCostAnnual} onChange={set("nursingCostAnnual")} prefix="$" />
          <button className="reset" onClick={handleReset}>Reset to Your Numbers (SSA $2,089)</button>
        </section>
        <section className="panel results">
          <div className="kpis">
            <div className="kpi highlight"><span>SSA Threshold - Monthly</span><strong>{fmt(calc.S_star_monthly)}</strong><small>Annual: {fmt(calc.S_star_annual)} - Gap = 0 here</small></div>
            <div className={calc.cur.gap >= 0 ? "kpi good" : "kpi bad"}><span>Your Status</span><strong>{status}</strong><small>Gap: {fmt(calc.cur.gap)}</small></div>
            <div className="kpi"><span>Total Wealth</span><strong>{fmt(calc.W_total)}</strong></div>
            <div className="kpi"><span>Home Excess</span><strong>{fmt(calc.excess)}</strong></div>
            <div className="kpi"><span>SSA Annual - Current</span><strong>{fmt(calc.cur.S_you)}</strong></div>
            <div className="kpi"><span>Net Burn D - Current</span><strong>{fmt(calc.cur.D)}</strong></div>
            <div className="kpi highlight"><span>Stocks Depletion Age - Current</span><strong>{calc.cur.sustainable ? "Never" : calc.cur.depletionAge ? fmtNum(calc.cur.depletionAge) + " yrs" : "-"}</strong></div>
            <div className="kpi highlight"><span>Break-Even W* - Current</span><strong>{fmt(calc.cur.W_star)}</strong></div>
          </div>
          <h2>Compare Two SSA Benefits Side-by-Side</h2>
          <div className="grid-header four"><span></span><span>{fmt(inp.compareSsaMonthly)} / mo</span><span>{fmt(inp.ssaMonthly)} / mo</span><span>Difference</span></div>
          <div className="grid-row four"><span>SSA Annual</span><span>{fmt(calc.cmp.S_you)}</span><span>{fmt(calc.cur.S_you)}</span><span>{fmt(calc.cur.S_you - calc.cmp.S_you)}</span></div>
          <div className="grid-row four"><span>Net Burn D</span><span>{fmt(calc.cmp.D)}</span><span>{fmt(calc.cur.D)}</span><span>{fmt(calc.cur.D - calc.cmp.D)}</span></div>
          <div className="grid-row four"><span>Depletion Age</span><span>{calc.cmp.depletionAge ? fmtNum(calc.cmp.depletionAge) : "Never"}</span><span>{calc.cur.depletionAge ? fmtNum(calc.cur.depletionAge) : "Never"}</span><span>{calc.cur.depletionAge && calc.cmp.depletionAge ? fmtNum(calc.cur.depletionAge - calc.cmp.depletionAge) + " yrs" : "-"}</span></div>
          <div className="grid-row four"><span>W* Break-Even</span><span>{fmt(calc.cmp.W_star)}</span><span>{fmt(calc.cur.W_star)}</span><span>{fmt(calc.cur.W_star - calc.cmp.W_star)}</span></div>
          <div className="grid-row four"><span>Gap</span><span>{fmt(calc.cmp.gap)}</span><span>{fmt(calc.cur.gap)}</span><span>{fmt(calc.cur.gap - calc.cmp.gap)}</span></div>
          <div className="equations">
            <h2>All Equations</h2>
            {equations.map((eq) => (
              <code key={eq}>{eq}</code>
            ))}
          </div>
          <h2>Care Scenarios</h2>
          <div className="grid-header"><span>Years</span><span>Total Cost</span><span>Forced From Home</span></div>
          {calc.care.map((c) => (
            <div className="grid-row" key={c.yrs}><span>{c.yrs} yr</span><span>{fmt(c.cost)}</span><span>{fmt(c.fromHome)}</span></div>
          ))}
          <h2>Projection - Current SSA</h2>
          <div className="bars">
            {calc.projection.map((p) => (
              <div className="bar-row" key={p.age}>
                <span className="bar-age">{p.age}</span>
                <div className="bar-track"><div className="bar-fill blue" style={{ width: `${(p.stocks / maxProj) * 100}%` }} /></div>
                <div className="bar-track"><div className="bar-fill green" style={{ width: `${(p.home / maxProj) * 100}%` }} /></div>
                <span className="bar-val">{fmt(p.total)}</span>
              </div>
            ))}
          </div>
          <div className="legend"><span className="blue">Blue = Stocks</span><span className="green">Green = Home</span></div>
          <p className="disclaimer">Educational model only. Uses constant r, g, D.</p>
        </section>
      </main>
    </div>
  );
}
