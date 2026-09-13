# Performance Metric Formulas Reference

## Sharpe Ratio

$$\text{Sharpe} = \frac{\bar{R}_p - R_f}{\sigma_p} \times \sqrt{252}$$

Where:
- $\bar{R}_p$ = mean daily portfolio return
- $R_f$ = daily risk-free rate (India 10Y G-Sec ≈ 6.5% annually → $R_f$ daily ≈ 0.065/252)
- $\sigma_p$ = standard deviation of daily returns
- 252 = annualization factor (trading days)

**Interpretation**: 
- < 0: Underperforming risk-free rate
- 0–1: Acceptable
- 1–2: Good
- > 2: Excellent

---

## Sortino Ratio

$$\text{Sortino} = \frac{\bar{R}_p - R_f}{\sigma_d} \times \sqrt{252}$$

Where:
- $\sigma_d$ = downside deviation (std of negative excess returns only)

**Advantage**: Only penalizes downside volatility, not upside.

---

## Maximum Drawdown (MDD)

$$\text{MDD} = \max_{t \in [0,T]} \left( \frac{\text{Peak}_t - \text{Value}_t}{\text{Peak}_t} \right)$$

Where:
- $\text{Peak}_t = \max_{s \in [0,t]} \text{Value}_s$ (running maximum)

**Interpretation**: The worst peak-to-trough decline. MDD of 25% means the 
portfolio lost 25% from its highest point before recovering.

---

## Calmar Ratio

$$\text{Calmar} = \frac{\text{Annualized Return}}{\text{Max Drawdown}}$$

**Interpretation**: Return per unit of maximum drawdown risk.
- < 1: Poor risk-adjusted return
- 1–3: Good
- > 3: Excellent

---

## Profit Factor

$$\text{PF} = \frac{\sum \text{Winning Trades}}{\sum |\text{Losing Trades}|}$$

**Interpretation**:
- < 1: Net loser
- 1.0–1.5: Marginal
- 1.5–2.0: Good
- > 2.0: Excellent

---

## Win Rate

$$\text{Win Rate} = \frac{\text{Number of Winning Trades}}{\text{Total Trades}}$$

**Note**: Win rate alone is misleading. A strategy with 30% win rate can be 
profitable if average win >> average loss.

---

## Expectancy (Expected Value per Trade)

$$E = (\text{Win Rate} \times \text{Avg Win}) - ((1 - \text{Win Rate}) \times |\text{Avg Loss}|)$$

**Interpretation**: Average expected profit per trade. Must be positive for 
a viable strategy.

---

## Annualized Return

$$R_{\text{ann}} = \bar{R}_{\text{daily}} \times 252$$

Or compounded:
$$R_{\text{ann}} = (1 + R_{\text{total}})^{252/N} - 1$$

Where $N$ = number of trading days in the backtest.

---

## Annualized Volatility

$$\sigma_{\text{ann}} = \sigma_{\text{daily}} \times \sqrt{252}$$

---

## India-Specific: Risk-Free Rate

| Benchmark | Approximate Rate (2024) | Source |
|---|---|---|
| India 10Y G-Sec | ~7.0% | RBI |
| India 91-day T-Bill | ~6.5% | RBI auction |
| Bank FD (SBI 1yr) | ~6.8% | SBI |
| Repo Rate (RBI) | 6.50% | RBI policy |

**Recommended for backtests**: Use the 91-day T-Bill rate as the risk-free 
rate. For simplicity, 6.5% annually is a reasonable constant.
