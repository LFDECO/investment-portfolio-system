# Indian Brokerage Fee Schedule Reference

## Discount Broker Model (Zerodha-equivalent, 2024-25)

### Equity Delivery (CNC)

| Charge | Rate | Applied On |
|---|---|---|
| Brokerage | ₹0 (free delivery) | — |
| STT | 0.1% | Buy + Sell turnover |
| Exchange Txn Charge | 0.00297% (NSE) | Turnover |
| SEBI Fee | ₹10 per crore (0.0001%) | Turnover |
| GST | 18% | Brokerage + Exchange Txn |
| Stamp Duty | 0.015% | Buy side only |
| DP Charges | ₹15.93 per scrip | Sell side only (CDSL) |

### Equity Intraday (MIS)

| Charge | Rate | Applied On |
|---|---|---|
| Brokerage | ₹20 per executed order (or 0.03%, whichever is lower) | Per order |
| STT | 0.025% | Sell side only |
| Exchange Txn Charge | 0.00297% (NSE) | Turnover |
| SEBI Fee | ₹10 per crore | Turnover |
| GST | 18% | Brokerage + Exchange Txn |
| Stamp Duty | 0.003% | Buy side only |

## Example Calculation — ₹1,00,000 Delivery Buy

```
Trade Value:           ₹1,00,000
Brokerage:             ₹0.00
STT (0.1%):            ₹100.00
Exchange Txn (0.00297%): ₹2.97
SEBI Fee (0.0001%):    ₹0.10
GST (18% of ₹2.97):   ₹0.53
Stamp Duty (0.015%):   ₹15.00
─────────────────────────────
Total Cost:            ₹118.60
Effective Cost:        0.119%
```

## Example Calculation — ₹1,00,000 Delivery Sell

```
Trade Value:           ₹1,00,000
Brokerage:             ₹0.00
STT (0.1%):            ₹100.00
Exchange Txn (0.00297%): ₹2.97
SEBI Fee (0.0001%):    ₹0.10
GST (18% of ₹2.97):   ₹0.53
DP Charges:            ₹15.93
─────────────────────────────
Total Cost:            ₹119.53
Effective Cost:        0.120%
```

## Round-Trip Cost (Buy + Sell Delivery)

```
Total Round-Trip Cost: ~₹238.13 on ₹1,00,000 trade
Effective Round-Trip:  ~0.238%
```

## Notes for Simulation

1. **Minimum order**: NSE minimum lot is 1 share for equity
2. **Circuit limits**: Individual stock bands are ±5%, ±10%, or ±20%
3. **T+1 settlement**: Delivery trades settle on T+1 (changed from T+2 in Jan 2023)
4. **Short selling**: Intraday short selling only for retail; no naked shorts in delivery
5. **Auction stocks**: Illiquid stocks may be in periodic call auction — wider spreads
