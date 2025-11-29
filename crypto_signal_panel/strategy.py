from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd

from crypto_signal_panel.utils import ema, sma, stdev, lowest, highest, change, anchored_vwap, atr


def rsi(series: pd.Series, length: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1/length, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/length, adjust=False).mean()
    rs = avg_gain / (avg_loss.replace(0, np.nan))
    rsi_vals = 100 - (100 / (1 + rs))
    return rsi_vals.fillna(0)


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal_len: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal = ema(macd_line, signal_len)
    hist = macd_line - signal
    return macd_line, signal, hist


def mom(series: pd.Series, length: int) -> pd.Series:
    return series.diff(length)


def cci(high: pd.Series, low: pd.Series, close: pd.Series, length: int) -> pd.Series:
    tp = (high + low + close) / 3.0
    tp_sma = sma(tp, length)
    md = tp.rolling(window=length, min_periods=length).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    cci_vals = (tp - tp_sma) / (0.015 * md.replace(0, np.nan))
    return cci_vals


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    prev_close = close.shift(1)
    direction = np.where(close > prev_close, volume, np.where(close < prev_close, -volume, 0))
    return pd.Series(direction, index=close.index).cumsum()


def stoch(high: pd.Series, low: pd.Series, close: pd.Series, length: int) -> Tuple[pd.Series, pd.Series]:
    lowest_l = lowest(low, length)
    highest_h = highest(high, length)
    denom = (highest_h - lowest_l).replace(0, np.nan)
    fast_k = (close - lowest_l) / denom * 100
    k = sma(fast_k, 3)
    d = sma(k, 3)
    return k, d


def vwma(close: pd.Series, volume: pd.Series, length: int) -> pd.Series:
    pv = (close * volume).rolling(window=length, min_periods=length).sum()
    v = volume.rolling(window=length, min_periods=length).sum()
    return pv / v.replace(0, np.nan)


def mfi(high: pd.Series, low: pd.Series, close: pd.Series, volume: pd.Series, length: int) -> pd.Series:
    tp = (high + low + close) / 3.0
    prev_tp = tp.shift(1)
    mf = tp * volume
    pos_mf = mf.where(tp > prev_tp, 0.0)
    neg_mf = mf.where(tp < prev_tp, 0.0)
    pos = pos_mf.rolling(window=length, min_periods=length).sum()
    neg = neg_mf.rolling(window=length, min_periods=length).sum()
    ratio = pos / neg.replace(0, np.nan)
    mfi_vals = 100 - (100 / (1 + ratio))
    return mfi_vals.fillna(0)


@dataclass
class StrategyState:
    accumulation_streak: int = 0
    pending_signal: bool = False
    bars_since_squeeze: int = 0
    last_signal_bar_index: Optional[int] = None


def _market_flow(df: pd.DataFrame, state: StrategyState) -> Dict:
    dma_y_period = 3
    cm2_multiplier = 10.0
    ema_cm3_len = 5
    low_lookback_cm4 = 30
    cm3_high_lookback_cm5 = 30
    low_lookback_cm6 = 60
    ema_cm7_len = 3
    cm8_scale_num = 10.0
    cm8_scale_denom = 618.0
    chips_alert_threshold = 0.1
    chips_confirmation_bars = 2

    low = df["low"]
    volume = df["volume"]

    x_nu = change(low).abs()
    x_de = change(low).clip(lower=0)
    loss = ema(x_nu, dma_y_period)
    gain = ema(x_de, dma_y_period)
    cm1 = pd.Series(np.where(gain > 0, loss / gain, loss / 1e-6), index=df.index)
    cm2 = cm1 * cm2_multiplier
    cm3 = ema(cm2, ema_cm3_len)
    cm4 = lowest(low, low_lookback_cm4)
    cm5 = highest(cm3, cm3_high_lookback_cm5)
    cm6 = pd.Series(np.where(low == lowest(low, low_lookback_cm6), 1, 0), index=df.index)
    cm7 = pd.Series(np.where(low <= cm4, (cm3 + cm5 * 2) / 2, 0), index=df.index)
    cm8 = cm8_scale_num * ema(cm7, ema_cm7_len) / cm8_scale_denom * cm6
    chips_value = pd.Series(np.where(volume > 0, cm8, 0), index=df.index)

    is_raw_accumulation = (chips_value > chips_alert_threshold) & (~chips_value.isna())

    # Update streak (stateful)
    if len(df) >= 1:
        if bool(is_raw_accumulation.iat[-1]):
            state.accumulation_streak += 1
        else:
            state.accumulation_streak = 0

    is_confirmed_accumulation = state.accumulation_streak >= chips_confirmation_bars
    return {
        "chips_value": float(chips_value.iat[-1]) if len(df) else 0.0,
        "is_confirmed_accumulation": is_confirmed_accumulation,
    }


def _trend_rider(df: pd.DataFrame) -> Dict:
    ema_long_period = 50
    pd_len = 22
    bbl = 20
    mult_vix = 2.0
    vix_ph_input = 0.85
    chips_threshold = 0.1
    prd = 5
    maxpp = 10
    maxbars = 100
    dontconfirm = False
    calcmacd = True
    calcmacda = True
    calcrsi = True
    calcstoc = True
    calccci = True
    calcmom = True
    calcobv = True
    calcvwmacd = True
    calccmf = True
    calcmfi = True
    bbw_length = 20
    bbw_mult = 2.0
    squeeze_lookback = 100
    squeeze_persist = 5
    stoch_rsi_len = 14
    stoch_rsi_k = 3
    stoch_rsi_d = 3
    stoch_oversold_level = 30

    high = df["high"]
    low = df["low"]
    close = df["close"]
    volume = df["volume"]

    isUptrend = close > ema(close, ema_long_period)
    isDowntrend = close < ema(close, ema_long_period)

    loss_cm = ema(change(low).abs(), 3)
    gain_cm = ema(change(low).clip(lower=0), 3)
    cm1_cm = pd.Series(np.where(gain_cm != 0, loss_cm / gain_cm, 0), index=df.index)
    cm2_cm = pd.Series(np.where(close * 1.2 > 0, cm1_cm * 10, cm1_cm / 10), index=df.index)
    cm3_cm = ema(cm2_cm, 5)
    cm4_cm = lowest(low, 30)
    cm5_cm = highest(cm3_cm, 30)
    cm6_cm = pd.Series(np.where(lowest(low, 60) > 0, 1, 0), index=df.index)
    cm7_cm = pd.Series(np.where(low <= cm4_cm, (cm3_cm + cm5_cm * 2) / 2, 0), index=df.index)
    cm8_cm = 10 * ema(cm7_cm, 3) / 618 * cm6_cm
    chips_raw = pd.Series(np.where(volume > 0, cm8_cm, 0), index=df.index)
    is_chips_accumulating = chips_raw > chips_threshold

    wvf = pd.Series(np.where(highest(close, pd_len) > 0,
                              (highest(close, pd_len) - low) / highest(close, pd_len) * 100,
                              0), index=df.index)
    sDev = mult_vix * stdev(wvf, bbl)
    midLine = sma(wvf, bbl)
    upperBand = midLine + sDev
    rangeHigh = highest(wvf, pd_len) * vix_ph_input
    is_vix_spike = (wvf >= upperBand) | (wvf >= rangeHigh)

    rsi_vals = rsi(close, 14)
    macd_line, macd_signal, deltamacd = macd(close, 12, 26, 9)
    moment = mom(close, 10)
    cci_vals = cci(high, low, close, 20)
    obv_vals = obv(close, volume)
    k, d = stoch(high, low, close, 14)
    stk = k
    maFast = vwma(close, volume, 12)
    maSlow = vwma(close, volume, 26)
    vwmacd = maFast - maSlow

    moneyFlowMultiplier = pd.Series(np.where((high - low) == 0, 0,
                                             (close - low - (high - close)) / (high - low)), index=df.index)
    moneyFlowVolume = moneyFlowMultiplier * volume
    sma_vol = sma(volume, 21)
    cmf = pd.Series(np.where(sma_vol == 0, 0, sma(moneyFlowVolume, 21) / sma_vol), index=df.index)
    mfi_vals = mfi(high, low, close, volume, 14)

    # Pivot points collections (simplified arrays limited to 20)
    def pivothigh(high_s: pd.Series, left: int, right: int) -> pd.Series:
        return high_s.where(high_s == highest(high_s.shift(right), left + right + 1))

    def pivotlow(low_s: pd.Series, left: int, right: int) -> pd.Series:
        return low_s.where(low_s == lowest(low_s.shift(right), left + right + 1))

    pivot_high = pivothigh(high, prd, prd)
    pivot_low = pivotlow(low, prd, prd)

    ph_positions: list[int] = []
    pl_positions: list[int] = []
    ph_vals: list[float] = []
    pl_vals: list[float] = []
    idx = list(range(len(df)))
    for i in idx:
        if not pd.isna(pivot_high.iat[i]):
            ph_positions.insert(0, i)
            ph_vals.insert(0, float(pivot_high.iat[i]))
            ph_positions = ph_positions[:20]
            ph_vals = ph_vals[:20]
        if not pd.isna(pivot_low.iat[i]):
            pl_positions.insert(0, i)
            pl_vals.insert(0, float(pivot_low.iat[i]))
            pl_positions = pl_positions[:20]
            pl_vals = pl_vals[:20]

    def _positive_regular_bullish_divergence(src: pd.Series) -> int:
        divlen = 0
        prsc = low
        startpoint = 0 if dontconfirm else 1
        for x in range(min(maxpp, len(pl_positions))):
            pos = pl_positions[x] if x < len(pl_positions) else 0
            val = pl_vals[x] if x < len(pl_vals) else np.nan
            if pos == 0:
                break
            len_bars = len(df) - pos + prd
            if len_bars > maxbars:
                break
            if len_bars > 5 and src.iat[startpoint] > src.iat[len_bars] and prsc.iat[startpoint] < (val if not np.isnan(val) else prsc.iat[startpoint]):
                slope1 = (src.iat[startpoint] - src.iat[len_bars]) / len_bars
                virtual_line1 = src.iat[len_bars]
                slope2 = (prsc.iat[startpoint] - (val if not np.isnan(val) else prsc.iat[startpoint])) / len_bars
                virtual_line2 = (val if not np.isnan(val) else prsc.iat[startpoint])
                arrived = True
                for y in range(1, len_bars):
                    virtual_line1 += slope1
                    virtual_line2 += slope2
                    if src.iat[len_bars - y] < virtual_line1 or low.iat[len_bars - y] < virtual_line2:
                        arrived = False
                        break
                if arrived:
                    divlen = len_bars
                    break
        return divlen

    def _positive_hidden_bullish_divergence(src: pd.Series) -> int:
        divlen = 0
        prsc = low
        startpoint = 0 if dontconfirm else 1
        for x in range(min(maxpp, len(pl_positions))):
            pos = pl_positions[x] if x < len(pl_positions) else 0
            val = pl_vals[x] if x < len(pl_vals) else np.nan
            if pos == 0:
                break
            len_bars = len(df) - pos + prd
            if len_bars > maxbars:
                break
            if len_bars > 5 and src.iat[startpoint] < src.iat[len_bars] and prsc.iat[startpoint] > (val if not np.isnan(val) else prsc.iat[startpoint]):
                slope1 = (src.iat[startpoint] - src.iat[len_bars]) / len_bars
                virtual_line1 = src.iat[len_bars]
                slope2 = (prsc.iat[startpoint] - (val if not np.isnan(val) else prsc.iat[startpoint])) / len_bars
                virtual_line2 = (val if not np.isnan(val) else prsc.iat[startpoint])
                arrived = True
                for y in range(1, len_bars):
                    virtual_line1 += slope1
                    virtual_line2 += slope2
                    if src.iat[len_bars - y] < virtual_line1 or low.iat[len_bars - y] > virtual_line2:
                        arrived = False
                        break
                if arrived:
                    divlen = len_bars
                    break
        return divlen

    is_bullish_divergence_detected = (
        (calcmacd and (_positive_regular_bullish_divergence(macd_line) > 0 or _positive_hidden_bullish_divergence(macd_line) > 0)) or
        (calcmacda and (_positive_regular_bullish_divergence(deltamacd) > 0 or _positive_hidden_bullish_divergence(deltamacd) > 0)) or
        (calcrsi and (_positive_regular_bullish_divergence(rsi_vals) > 0 or _positive_hidden_bullish_divergence(rsi_vals) > 0)) or
        (calcstoc and (_positive_regular_bullish_divergence(stk) > 0 or _positive_hidden_bullish_divergence(stk) > 0)) or
        (calccci and (_positive_regular_bullish_divergence(cci_vals) > 0 or _positive_hidden_bullish_divergence(cci_vals) > 0)) or
        (calcmom and (_positive_regular_bullish_divergence(moment) > 0 or _positive_hidden_bullish_divergence(moment) > 0)) or
        (calcobv and (_positive_regular_bullish_divergence(obv_vals) > 0 or _positive_hidden_bullish_divergence(obv_vals) > 0)) or
        (calcvwmacd and (_positive_regular_bullish_divergence(vwmacd) > 0 or _positive_hidden_bullish_divergence(vwmacd) > 0)) or
        (calccmf and (_positive_regular_bullish_divergence(cmf) > 0 or _positive_hidden_bullish_divergence(cmf) > 0)) or
        (calcmfi and (_positive_regular_bullish_divergence(mfi_vals) > 0 or _positive_hidden_bullish_divergence(mfi_vals) > 0))
    )

    basis = sma(close, bbw_length)
    dev = bbw_mult * stdev(close, bbw_length)
    bbw = pd.Series(np.where(basis == 0, 0, 2 * dev / basis * 100), index=df.index)
    is_squeeze_now = bbw <= lowest(bbw, squeeze_lookback)

    return {
        "is_vix_spike": bool(is_vix_spike.iat[-1]) if len(df) else False,
        "is_chips_accumulating": bool(is_chips_accumulating.iat[-1]) if len(df) else False,
        "is_bullish_divergence_detected": bool(is_bullish_divergence_detected),
        "is_squeeze_now": bool(is_squeeze_now.iat[-1]) if len(df) else False,
    }


def _vwap_price_channel(df: pd.DataFrame, length: int = 20) -> Tuple[float, float, float, float, float, int, int]:
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    hst = highest(high, length)
    lst = lowest(low, length)
    new_high = high == hst
    new_low = low == lst

    # Anchored VWAP streams
    h_vwap = anchored_vwap(high, volume, new_high)
    l_vwap = anchored_vwap(low, volume, new_low)

    h_change = change(h_vwap)
    l_change = change(l_vwap)

    upper = pd.Series(index=df.index, dtype=float)
    lower = pd.Series(index=df.index, dtype=float)
    dir = pd.Series(index=df.index, dtype=int)
    dir2 = pd.Series(index=df.index, dtype=int)

    for i in range(len(df)):
        if bool(new_high.iat[i]):
            upper.iat[i] = float(hst.iat[i])
            dir.iat[i] = 1
            dir2.iat[i] = 1
        elif i > 0:
            prev_upper = upper.iat[i - 1]
            if hst.iat[i] == hst.iat[i - 1]:
                upper.iat[i] = prev_upper + (h_change.iat[i] if not np.isnan(h_change.iat[i]) else 0)
            else:
                upper.iat[i] = min(hst.iat[i], prev_upper + (h_change.iat[i] if not np.isnan(h_change.iat[i]) else 0))
            dir.iat[i] = 1 if bool(new_high.iat[i]) else (-1 if bool(new_low.iat[i]) else 0)
            dir2.iat[i] = 1 if bool(new_high.iat[i]) else (-1 if bool(new_low.iat[i]) else (dir2.iat[i - 1] if i > 0 else 0))
        else:
            upper.iat[i] = float(hst.iat[i])
            dir.iat[i] = 1 if bool(new_high.iat[i]) else (-1 if bool(new_low.iat[i]) else 0)
            dir2.iat[i] = dir.iat[i]

        if bool(new_low.iat[i]):
            lower.iat[i] = float(lst.iat[i])
        elif i > 0:
            prev_lower = lower.iat[i - 1]
            if lst.iat[i] == lst.iat[i - 1]:
                lower.iat[i] = prev_lower + (l_change.iat[i] if not np.isnan(l_change.iat[i]) else 0)
            else:
                lower.iat[i] = max(lst.iat[i], prev_lower + (l_change.iat[i] if not np.isnan(l_change.iat[i]) else 0))
        else:
            lower.iat[i] = float(lst.iat[i])

    mid = (upper + lower) / 2.0
    return (
        float(upper.iat[-1]),
        float(lower.iat[-1]),
        float(mid.iat[-1]),
        float(hst.iat[-1]),
        float(lst.iat[-1]),
        int(dir.iat[-1] if not np.isnan(dir.iat[-1]) else 0),
        int(dir2.iat[-1] if not np.isnan(dir2.iat[-1]) else 0),
    )


def compute_signal(df: pd.DataFrame, state: StrategyState) -> Dict:
    mf = _market_flow(df, state)
    tr = _trend_rider(df)
    upper, lower, mid, hst, lst, dir, dir2 = _vwap_price_channel(df, 20)

    accumulation_signal = mf["is_confirmed_accumulation"]
    panic_mode = tr["is_vix_spike"]

    normal_entry = accumulation_signal and (not panic_mode)

    if accumulation_signal and panic_mode:
        state.pending_signal = True

    pending_entry = state.pending_signal and (not panic_mode)
    if pending_entry:
        state.pending_signal = False

    long_condition = normal_entry or pending_entry

    atr_length = 14
    atr_multiplier_sl = 1.5
    sl_price_series = df["close"] - atr(df, atr_length) * atr_multiplier_sl
    sl_price = float(sl_price_series.iat[-1]) if len(df) else np.nan

    if long_condition:
        state.last_signal_bar_index = len(df) - 1

    bars_since = 0
    if state.last_signal_bar_index is not None:
        bars_since = max(0, (len(df) - 1) - state.last_signal_bar_index)

    return {
        "long_condition": bool(long_condition),
        "tp_target": float(upper),
        "sl_price": float(sl_price),
        "chips_value": float(mf["chips_value"]),
        "bars_since": int(bars_since),
        "pending_signal": bool(state.pending_signal),
    }
