import { useMemo, useState } from "react";
import "./index.css";

type Inputs = {
  age: number;
  lifeExpectancy: number;
  homeEquity: number;
  stocks: number;
  ssaMonthly: number;
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

export default function App() {
  const [inp, setInp] = useState<Inputs>(DEFAULTS);
  const set = (k: keyof Inputs) => (v: number) => setInp((p) => ({ ...p, [k]: v }));

  const calc = useMemo(() => {
    const r = inp.stockReturn / 100;
    const g = inp.homeGrowth / 100;
    const dRate = inp.discountRate / 100;
    const S_you = inp.ssaMonthly * 12;
    const W_total = inp.homeEquity + inp.stocks;
    const excess = Math.max(0, inp.homeEquity - inp.homeLimit);
    const D = inp.annualSpending - S_you;
    const years = Math.max(0, inp.lifeExpectancy - inp.age);
    const A = dRate === 0 ? years : (1 - Math.exp(-dRate * years)) / dRate;
    const W_star = inp.poorAssets + (inp.poorSsaAnnual + inp.poorBenefitsAnnual - S_you) * A;
    const gap = inp.stocks - W_star;
    let depletionAge: number | null = null;
    let depletionYears: number | null = null;
    let sustainable = false;
    if (D <= 0) {
      sustainable = true;
    } else if (r === 0) {
      depletionYears = inp.stocks / D;
      depletionAge = inp.age + depletionYears;
    } else {
      const Dr = D / r;
      if (Dr <= inp.stocks) {
        sustainable = true;
      } else {
        depletionYears = Math.log(Dr / (Dr - inp.stocks)) / r;
        depletionAge = inp.age + depletionYears;
      }
    }
    const stocksAt = (age: number) => {
      const dt = age - inp.age;
      if (r === 0) return Math.max(0, inp.stocks - D * dt);
      return Math.max(0, (inp.stocks - D / r) * Math.exp(r * dt) + D / r);
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
    return { r, g, S_you, W_total, excess, D, A, W_star, gap, depletionAge, depletionYears, sustainable, projection, care, Dr: r === 0 ? 0 : D / r, coeff: r === 0 ? 0 : inp.stocks - D / r };
  }, [inp]);

  const equations: string[] = [
    `W_total = HomeEquity + Stocks = ${fmt(calc.W_total)}`,
    `E = max(0, HomeEquity - L_home) = ${fmt(calc.excess)}`,
    `S_you = SSA_monthly x 12 = ${fmt(calc.S_you)}`,
    `D = Spending - S_you = ${fmt(calc.D)}`,
    `W_stocks(t) = (${fmt(calc.coeff)}) * e^(${fmtNum(calc.r)}*(t-${inp.age})) + ${fmt(calc.Dr)}`,
    `x_house(t) = ${fmt(inp.homeEquity)} * e^(${fmtNum(calc.g)}*(t-${inp.age}))`,
    `A = (1 - e^(-d*T))/d = ${fmtNum(calc.A, 2)}`,
    `W* = PoorAssets + (PoorSSA + Bmax - S_you)*A = ${fmt(calc.W_star)}`,
    `Gap = Stocks - W* = ${fmt(calc.gap)}`,
  ];

  const maxProj = Math.max(...calc.projection.map((p) => p.total), 1);

  return (
    <div className="page">
      <header className="header">
        <h1>Retirement Wealth Break-Even Calculator</h1>
        <p>California - Medi-Cal regular has no asset test since 2024 - LTC has home equity limit</p>
	<p>Developed by: Long Nguyen</p>
      </header>
      <main className="layout">
        <section className="panel inputs">
          <h2>Your Inputs</h2>
          <h3>Your Wealth</h3>
          <Field label="Current Age" value={inp.age} onChange={set("age")} />
          <Field label="Life Expectancy" value={inp.lifeExpectancy} onChange={set("lifeExpectancy")} />
          <Field label="Home Equity" value={inp.homeEquity} onChange={set("homeEquity")} prefix="$" />
          <Field label="Stocks / Liquid Savings" value={inp.stocks} onChange={set("stocks")} prefix="$" />
          <h3>Income and Spending</h3>
          <Field label="SSA Monthly Benefit" value={inp.ssaMonthly} onChange={set("ssaMonthly")} prefix="$" />
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
          <button className="reset" onClick={() => setInp(DEFAULTS)}>Reset to Your Numbers</button>
        </section>
        <section className="panel results">
          <div className="kpis">
            <div className="kpi"><span>Total Wealth</span><strong>{fmt(calc.W_total)}</strong></div>
            <div className="kpi"><span>Home Excess</span><strong>{fmt(calc.excess)}</strong></div>
            <div className="kpi"><span>SSA Annual</span><strong>{fmt(calc.S_you)}</strong></div>
            <div className="kpi"><span>Net Burn D</span><strong>{fmt(calc.D)}</strong></div>
            <div className="kpi highlight"><span>Stocks Depletion Age</span><strong>{calc.sustainable ? "Never" : calc.depletionAge ? fmtNum(calc.depletionAge) + " yrs" : "-"}</strong></div>
            <div className="kpi highlight"><span>Break-Even W*</span><strong>{fmt(calc.W_star)}</strong></div>
            <div className={calc.gap >= 0 ? "kpi good" : "kpi bad"}><span>Gap</span><strong>{fmt(calc.gap)}</strong><small>{calc.gap >= 0 ? "Above break-even" : "Below break-even"}</small></div>
          </div>
          <div className="equations">
            <h2>All Equations</h2>
            {equations.map((eq) => (
              <code key={eq}>{eq}</code>
            ))}
          </div>
          <h2>Care Scenarios</h2>
          <div className="grid-header"><span>Years</span><span>Total Cost</span><span>Forced From Home</span></div>
          {calc.care.map((c) => (
            <div className="grid-row" key={c.yrs}>
              <span>{c.yrs} yr</span><span>{fmt(c.cost)}</span><span>{fmt(c.fromHome)}</span>
            </div>
          ))}
          <h2>Projection - Bar Chart (divs, no SVG)</h2>
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
          <h2>Year-by-Year</h2>
          <div className="grid-header"><span>Age</span><span>Stocks</span><span>Home</span><span>Total</span></div>
          {calc.projection.map((p) => (
            <div className="grid-row four" key={p.age}>
              <span>{p.age}</span><span>{fmt(p.stocks)}</span><span>{fmt(p.home)}</span><span>{fmt(p.total)}</span>
            </div>
          ))}
          <p className="disclaimer">Educational model only. Uses constant r, g, D.</p>
        </section>
      </main>
    </div>
  );
}
