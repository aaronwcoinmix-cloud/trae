import math
import time
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

import numpy as np
import pandas as pd


TV_TIMEFRAME_MAP = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
    "1M": "M",
}


def tradingview_link(symbol: str, timeframe: str, market: str = "BINANCE") -> str:
    base = symbol.replace("/", "")
    tf = TV_TIMEFRAME_MAP.get(timeframe, timeframe)
    return f"https://www.tradingview.com/chart/?symbol={market}:{base}&interval={tf}"


def ema(series: pd.Series, length: int) -> pd.Series:
    return series.ewm(span=length, adjust=False).mean()


def sma(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(window=length, min_periods=length).mean()


def stdev(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(window=length, min_periods=length).std(ddof=0)


def lowest(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(window=length, min_periods=length).min()


def highest(series: pd.Series, length: int) -> pd.Series:
    return series.rolling(window=length, min_periods=length).max()


def change(series: pd.Series) -> pd.Series:
    return series.diff()


def atr(df: pd.DataFrame, length: int) -> pd.Series:
    high = df["high"]
    low = df["low"]
    close = df["close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        (high - low),
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(window=length, min_periods=length).mean()


def anchored_vwap(prices: pd.Series, volumes: pd.Series, anchor: pd.Series) -> pd.Series:
    vwap_vals = []
    cum_pv = 0.0
    cum_v = 0.0
    for i in range(len(prices)):
        if bool(anchor.iat[i]):
            cum_pv = float(prices.iat[i] * volumes.iat[i])
            cum_v = float(volumes.iat[i])
        else:
            cum_pv += float(prices.iat[i] * volumes.iat[i])
            cum_v += float(volumes.iat[i])
        vwap_vals.append(cum_pv / cum_v if cum_v > 0 else np.nan)
    return pd.Series(vwap_vals, index=prices.index)


@dataclass
class Signal:
    symbol: str
    market_type: str
    timeframe: str
    signal_time: int
    current_price: float
    bars_since: int
    upper_target: float
    atr_stop: float
    strength: float


def now_ms() -> int:
    return int(time.time() * 1000)


def ohlcv_to_df(ohlcv: List[List[float]]) -> pd.DataFrame:
    df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df.set_index("timestamp", inplace=True)
    return df


def clip_history(history: List[Dict], limit: int) -> List[Dict]:
    return history[-limit:]
