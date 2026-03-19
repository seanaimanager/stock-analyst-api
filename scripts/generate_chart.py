#!/usr/bin/env python3
"""
Generate a candlestick chart with price projections for stock analysis.

Usage:
  python3 generate_chart.py <TICKER> <output.png> \
    --bull-low <price> --bull-high <price> \
    --bear-low <price> --bear-high <price> \
    --supports <p1,p2,...> \
    --resistances <p1,p2,...> \
    --current <price>
"""

import sys
import argparse
import warnings
warnings.filterwarnings("ignore")

import yfinance as yf
import mplfinance as mpf
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.lines as mlines
import pandas as pd
import numpy as np
from matplotlib.patches import FancyArrowPatch


# ── Palette ──────────────────────────────────────────────────────────────────
BG        = "#0D1117"
CARD      = "#161B22"
BORDER    = "#30363D"
TEXT      = "#E6EDF3"
TEXT_DIM  = "#8B949E"
ACCENT    = "#58A6FF"
GREEN     = "#3FB950"
RED       = "#F85149"
YELLOW    = "#D29922"
PURPLE    = "#BC8CFF"
ORANGE    = "#FF7B00"


def fetch_ohlcv(ticker: str, period: str = "6mo") -> pd.DataFrame:
    t = yf.Ticker(ticker)
    df = t.history(period=period, interval="1d", auto_adjust=True)
    if df.empty:
        raise ValueError(f"No data returned for {ticker}")
    df.index = pd.DatetimeIndex(df.index.date)
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.dropna(inplace=True)
    return df


def add_moving_averages(df: pd.DataFrame):
    addplots = []
    for window, color, label in [(20, ACCENT, "20MA"), (50, YELLOW, "50MA"), (100, PURPLE, "100MA")]:
        if len(df) >= window:
            ma = df["Close"].rolling(window).mean()
            addplots.append(mpf.make_addplot(ma, color=color, width=1.2,
                                              label=label, secondary_y=False))
    return addplots


def draw_projection_zones(ax, df, bull_low, bull_high, bear_low, bear_high,
                           supports, resistances, current_price):
    last_date  = df.index[-1]
    first_date = df.index[0]
    total_days = (last_date - first_date).days or 1

    # x-axis in mplfinance is integer-indexed
    n = len(df)
    proj_start = n - 1          # last candle
    proj_end   = n + int(n * 0.22)  # ~22% extra space to the right

    # ── Bull zone ─────────────────────────────────────────────────────────────
    if bull_low and bull_high:
        ax.axhspan(bull_low, bull_high,
                   xmin=(proj_start) / (proj_end + 2),
                   xmax=1.0,
                   alpha=0.18, color=GREEN, zorder=2)
        ax.annotate(
            f"  BULL  ${bull_low:.0f}–${bull_high:.0f}",
            xy=(proj_start + 1, (bull_low + bull_high) / 2),
            fontsize=7.5, color=GREEN, fontweight="bold",
            va="center", ha="left",
            bbox=dict(boxstyle="round,pad=0.25", fc=CARD, ec=GREEN,
                      alpha=0.85, linewidth=0.8),
            zorder=5,
        )
        # arrow from current price toward bull zone
        if current_price and bull_low > current_price:
            ax.annotate(
                "", xy=(proj_start + 3, bull_low),
                xytext=(proj_start, current_price),
                arrowprops=dict(arrowstyle="-|>", color=GREEN,
                                lw=1.2, mutation_scale=10),
                zorder=4,
            )

    # ── Bear zone ─────────────────────────────────────────────────────────────
    if bear_low and bear_high:
        ax.axhspan(bear_low, bear_high,
                   xmin=(proj_start) / (proj_end + 2),
                   xmax=1.0,
                   alpha=0.18, color=RED, zorder=2)
        ax.annotate(
            f"  BEAR  ${bear_low:.0f}–${bear_high:.0f}",
            xy=(proj_start + 1, (bear_low + bear_high) / 2),
            fontsize=7.5, color=RED, fontweight="bold",
            va="center", ha="left",
            bbox=dict(boxstyle="round,pad=0.25", fc=CARD, ec=RED,
                      alpha=0.85, linewidth=0.8),
            zorder=5,
        )
        if current_price and bear_high < current_price:
            ax.annotate(
                "", xy=(proj_start + 3, bear_high),
                xytext=(proj_start, current_price),
                arrowprops=dict(arrowstyle="-|>", color=RED,
                                lw=1.2, mutation_scale=10),
                zorder=4,
            )

    # ── Support lines ─────────────────────────────────────────────────────────
    for s in (supports or []):
        ax.axhline(y=s, color=GREEN, linewidth=0.8,
                   linestyle="--", alpha=0.7, zorder=3)
        ax.annotate(f" S ${s:.0f}", xy=(0, s),
                    fontsize=7, color=GREEN, va="bottom", ha="left",
                    alpha=0.9, zorder=4)

    # ── Resistance lines ──────────────────────────────────────────────────────
    for r in (resistances or []):
        ax.axhline(y=r, color=RED, linewidth=0.8,
                   linestyle="--", alpha=0.7, zorder=3)
        ax.annotate(f" R ${r:.0f}", xy=(0, r),
                    fontsize=7, color=RED, va="bottom", ha="left",
                    alpha=0.9, zorder=4)

    # ── Current price dotted line ─────────────────────────────────────────────
    if current_price:
        ax.axhline(y=current_price, color=ACCENT, linewidth=1.0,
                   linestyle=":", alpha=0.9, zorder=3)
        ax.annotate(f" NOW ${current_price:.0f}",
                    xy=(proj_start, current_price),
                    fontsize=7.5, color=ACCENT, va="bottom",
                    fontweight="bold", alpha=0.95, zorder=5)


def build_legend(ax, show_ma20, show_ma50, show_ma100):
    handles = []
    if show_ma20:
        handles.append(mlines.Line2D([], [], color=ACCENT,  linewidth=1.2, label="20 MA"))
    if show_ma50:
        handles.append(mlines.Line2D([], [], color=YELLOW,  linewidth=1.2, label="50 MA"))
    if show_ma100:
        handles.append(mlines.Line2D([], [], color=PURPLE,  linewidth=1.2, label="100 MA"))
    handles.append(mpatches.Patch(color=GREEN, alpha=0.5, label="Bull Target"))
    handles.append(mpatches.Patch(color=RED,   alpha=0.5, label="Bear Target"))
    handles.append(mlines.Line2D([], [], color=GREEN, linewidth=0.8,
                                  linestyle="--", label="Support"))
    handles.append(mlines.Line2D([], [], color=RED,   linewidth=0.8,
                                  linestyle="--", label="Resistance"))
    handles.append(mlines.Line2D([], [], color=ACCENT, linewidth=1.0,
                                  linestyle=":", label="Current Price"))
    ax.legend(handles=handles, loc="upper left",
              framealpha=0.6, facecolor=CARD, edgecolor=BORDER,
              labelcolor=TEXT, fontsize=7.5, ncol=2)


def generate(ticker, output_path, bull_low=None, bull_high=None,
             bear_low=None, bear_high=None,
             supports=None, resistances=None, current_price=None):

    df = fetch_ohlcv(ticker)
    n  = len(df)

    mc = mpf.make_marketcolors(
        up=GREEN, down=RED,
        edge={"up": GREEN, "down": RED},
        wick={"up": GREEN, "down": RED},
        volume={"up": "#1f4e2b", "down": "#4e1f1f"},
    )
    style = mpf.make_mpf_style(
        marketcolors=mc,
        facecolor=BG,
        edgecolor=BORDER,
        figcolor=BG,
        gridcolor=BORDER,
        gridstyle="--",
        gridaxis="both",
        y_on_right=True,
        rc={
            "axes.labelcolor": TEXT_DIM,
            "xtick.color": TEXT_DIM,
            "ytick.color": TEXT_DIM,
            "font.family": "monospace",
        },
    )

    addplots = add_moving_averages(df)
    n_extra  = int(n * 0.22)

    fig, axes = mpf.plot(
        df,
        type="candle",
        style=style,
        volume=True,
        addplot=addplots if addplots else None,
        figsize=(14, 8),
        title="",
        tight_layout=False,
        returnfig=True,
        xlim=(-1, n + n_extra),
        show_nontrading=False,
    )

    ax_main = axes[0]
    ax_vol  = axes[2] if len(axes) > 2 else None

    draw_projection_zones(
        ax_main, df,
        bull_low, bull_high,
        bear_low, bear_high,
        supports, resistances,
        current_price,
    )

    build_legend(
        ax_main,
        show_ma20  = len(df) >= 20,
        show_ma50  = len(df) >= 50,
        show_ma100 = len(df) >= 100,
    )

    # ── Title block ───────────────────────────────────────────────────────────
    last_close = df["Close"].iloc[-1]
    prev_close = df["Close"].iloc[-2] if len(df) > 1 else last_close
    chg        = last_close - prev_close
    chg_pct    = (chg / prev_close) * 100
    chg_color  = GREEN if chg >= 0 else RED
    chg_sign   = "+" if chg >= 0 else ""

    fig.text(0.01, 0.97,
             f"{ticker}  —  Price Projection Chart",
             color=TEXT, fontsize=14, fontweight="bold", va="top")
    fig.text(0.01, 0.935,
             f"Last Close: ${last_close:.2f}  "
             f"({chg_sign}{chg:.2f} / {chg_sign}{chg_pct:.2f}%)  "
             f"│  6-Month History + 3-Month Projection Zones",
             color=TEXT_DIM, fontsize=9, va="top")

    # ── Volume axis styling ───────────────────────────────────────────────────
    if ax_vol:
        ax_vol.set_facecolor(BG)
        ax_vol.yaxis.label.set_color(TEXT_DIM)

    plt.subplots_adjust(top=0.90, bottom=0.08, left=0.01, right=0.94)

    fig.savefig(output_path, dpi=150, facecolor=BG,
                bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)
    print(f"Chart saved: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("ticker")
    parser.add_argument("output")
    parser.add_argument("--bull-low",    type=float, default=None)
    parser.add_argument("--bull-high",   type=float, default=None)
    parser.add_argument("--bear-low",    type=float, default=None)
    parser.add_argument("--bear-high",   type=float, default=None)
    parser.add_argument("--supports",    type=str,   default="")
    parser.add_argument("--resistances", type=str,   default="")
    parser.add_argument("--current",     type=float, default=None)
    args = parser.parse_args()

    supports    = [float(x) for x in args.supports.split(",")    if x.strip()]
    resistances = [float(x) for x in args.resistances.split(",") if x.strip()]

    generate(
        ticker        = args.ticker.upper(),
        output_path   = args.output,
        bull_low      = args.bull_low,
        bull_high     = args.bull_high,
        bear_low      = args.bear_low,
        bear_high     = args.bear_high,
        supports      = supports,
        resistances   = resistances,
        current_price = args.current,
    )
