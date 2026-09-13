#!/usr/bin/env python3
"""
End-to-End Orchestration Entry Point for Quantitative Trading Simulation.

Usage:
    uv run python main.py --ticker POWERGRID.NS --start 2023-01-01 --end 2024-01-01 --strategy momentum
"""
import argparse
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("quant-trading-sim")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Autonomous Event-Driven Quantitative Trading Simulation (Indian Equities)"
    )
    parser.add_argument("--ticker", type=str, default="POWERGRID.NS", help="NSE ticker symbol")
    parser.add_argument("--start", type=str, default="2023-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2024-01-01", help="End date (YYYY-MM-DD)")
    parser.add_argument(
        "--initial-cash", type=float, default=1_000_000.0, help="Initial portfolio capital in INR"
    )
    parser.add_argument(
        "--strategy",
        type=str,
        default="momentum",
        choices=["momentum", "mean_reversion", "sentiment", "rl"],
        help="Strategy agent to execute",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logger.info("Initializing Quant Trading Simulation Subsystem (Phase 0 Bootstrap)")
    logger.info(f"Target Ticker: {args.ticker} | Time Window: {args.start} -> {args.end}")
    logger.info(f"Strategy: {args.strategy} | Initial Capital: ₹{args.initial_cash:,.2f}")
    logger.info("Subsystem schemas and package hierarchy initialized successfully.")


if __name__ == "__main__":
    main()
