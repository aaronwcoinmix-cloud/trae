import asyncio
import queue
import io
import threading
import time
import wave
from typing import Dict, List

import pandas as pd
import streamlit as st
import ccxt
import altair as alt
try:
    from plyer import notification
except Exception:
    class notification:
        @staticmethod
        def notify(title: str, message: str, timeout: int = 3):
            pass

from crypto_signal_panel.scanner import SignalScanner, load_config
from crypto_signal_panel.utils import tradingview_link, clip_history


def generate_beep_wav(duration_sec: float = 0.2, freq: int = 880, sample_rate: int = 44100) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        n_samples = int(duration_sec * sample_rate)
        for i in range(n_samples):
            val = int(32767.0 * 0.3 * (abs(__import__('math').sin(2 * __import__('math').pi * freq * (i / sample_rate)))))
            wf.writeframesraw(val.to_bytes(2, byteorder='little', signed=True))
    return buf.getvalue()


def start_scanner_thread(config_path: str):
    if 'signal_queue' not in st.session_state:
        st.session_state.signal_queue = queue.Queue()
    if 'history' not in st.session_state:
        st.session_state.history = []
    if 'status_queue' not in st.session_state:
        st.session_state.status_queue = queue.Queue()
    if 'pair_status' not in st.session_state:
        st.session_state.pair_status = {}
    if 'scanner_thread_started' not in st.session_state:
        st.session_state.scanner_thread_started = False

    sig_q = st.session_state.signal_queue
    stat_q = st.session_state.status_queue

    def runner():
        cfg = load_config(config_path)
        scanner = SignalScanner(cfg)
        async def main():
            await scanner.run(sig_q, stat_q)
        asyncio.run(main())

    if not st.session_state.scanner_thread_started:
        t = threading.Thread(target=runner, daemon=True)
        t.start()
        st.session_state.scanner_thread_started = True


st.set_page_config(page_title="Reversal Strategy Signals", layout="wide")
st.title("币安实时多币种信号面板（Reversal Strategy）")

config_path_default = "crypto_signal_panel/config.yaml"
config_path = st.sidebar.text_input("配置文件路径", value=config_path_default)
refresh_seconds = st.sidebar.slider("刷新间隔（秒）", 1, 10, 2)
auto_refresh_enabled = st.sidebar.checkbox("启用自动刷新", value=False, key="auto_refresh_enabled")
if st.sidebar.button("立即刷新"):
    st.rerun()
if auto_refresh_enabled:
    try:
        from streamlit import st_autorefresh
        st_autorefresh(interval=refresh_seconds * 1000, key="auto_refresh")
    except Exception:
        st.markdown(f"<meta http-equiv='refresh' content='{refresh_seconds}'>", unsafe_allow_html=True)

start_scanner_thread(config_path)

tab_live, tab_status, tab_history, tab_summary = st.tabs(["实时信号", "监控状态", "历史记录", "最近1小时汇总"]) 

sound_on = True
notify_on = True

beep_bytes = generate_beep_wav()

# Drain queues once per run
new_signals: List[Dict] = []
try:
    while True:
        sig = st.session_state.signal_queue.get_nowait()
        new_signals.append(sig)
except queue.Empty:
    pass
try:
    while True:
        stat = st.session_state.status_queue.get_nowait()
        key = (stat.get("symbol"), stat.get("market_type"), stat.get("timeframe"))
        st.session_state.pair_status[key] = stat
except queue.Empty:
    pass

if new_signals:
    st.session_state.history.extend(new_signals)
    st.session_state.history = clip_history(st.session_state.history, limit=50)

with tab_live:
    col1, col2, col3, col4 = st.columns(4)
    total_pairs = len(st.session_state.pair_status)
    total_signals = len(st.session_state.history)
    error_count = sum(1 for v in st.session_state.pair_status.values() if v.get("error"))
    mode_display = "websocket" if any(v.get("mode") == "websocket" for v in st.session_state.pair_status.values()) else "rest"
    col1.metric("监控资产数", total_pairs)
    col2.metric("累计信号数", total_signals)
    col3.metric("错误数", error_count)
    col4.metric("连接模式", mode_display)

    tf_filter = st.multiselect("周期筛选", options=["15m", "30m", "1h", "4h", "1d"], default=["15m", "30m", "1h"], key="tf_filter")
    mt_filter = st.multiselect("市场类型", options=["spot", "futures"], default=["spot", "futures"], key="mt_filter")

    if st.session_state.history:
        df = pd.DataFrame(st.session_state.history)
        df = df[df["timeframe"].isin(tf_filter)]
        df = df[df["market_type"].isin(mt_filter)]
        df_display = df.copy()
        df_display["TradingView"] = df_display.apply(lambda r: tradingview_link(r["symbol"], r["timeframe"]), axis=1)
        for col in ["current_price", "upper_target", "atr_stop", "strength"]:
            if col in df_display:
                df_display[col] = pd.to_numeric(df_display[col], errors="coerce").round(6)
        st.dataframe(df_display[[
            "symbol", "timeframe", "signal_time", "current_price", "bars_since",
            "upper_target", "atr_stop", "strength", "TradingView"
        ]].sort_values(by=["signal_time"], ascending=False), use_container_width=True)

        if 'notified_ids' not in st.session_state:
            st.session_state.notified_ids = set()
        latest = new_signals[-1] if new_signals else None
        if latest:
            nid = f"{latest['symbol']}-{latest['timeframe']}-{latest['signal_time']}"
            if nid not in st.session_state.notified_ids:
                st.session_state.notified_ids.add(nid)
                st.toast(f"{latest['symbol']} {latest['timeframe']} 出现买入信号")
                if sound_on:
                    st.audio(beep_bytes, format='audio/wav')
                if notify_on:
                    notification.notify(title="买入信号", message=f"{latest['symbol']} {latest['timeframe']} 触发", timeout=3)
    else:
        st.info("当前暂无实时信号")

    st.subheader("BTC/USDT 实时价格")
    btc_mt = st.selectbox("市场类型", options=["spot", "futures"], index=0, key="btc_mt_chart")
    btc_tf = st.selectbox("周期", options=["1m", "5m", "15m", "30m", "1h"], index=0, key="btc_tf_chart")
    cfg_chart = load_config(config_path)
    if btc_mt == "futures":
        exch_chart = ccxt.binance({"enableRateLimit": True, "apiKey": cfg_chart.get("exchange", {}).get("api_key"), "secret": cfg_chart.get("exchange", {}).get("secret"), "options": {"defaultType": "future"}})
    else:
        exch_chart = ccxt.binance({"enableRateLimit": True, "apiKey": cfg_chart.get("exchange", {}).get("api_key"), "secret": cfg_chart.get("exchange", {}).get("secret")})
    try:
        exch_chart.load_markets()
        ohlcv_chart = exch_chart.fetch_ohlcv("BTC/USDT", timeframe=btc_tf, limit=200)
        df_chart = pd.DataFrame(ohlcv_chart, columns=["ts", "open", "high", "low", "close", "vol"])
        df_chart["ts"] = pd.to_datetime(df_chart["ts"], unit="ms")
        chart = alt.Chart(df_chart).mark_line().encode(x="ts:T", y="close:Q")
        st.altair_chart(chart, use_container_width=True)
    except Exception as e:
        try:
            alt_mt = "spot" if btc_mt == "futures" else "futures"
            if alt_mt == "futures":
                exch_chart = ccxt.binance({"enableRateLimit": True, "apiKey": cfg_chart.get("exchange", {}).get("api_key"), "secret": cfg_chart.get("exchange", {}).get("secret"), "options": {"defaultType": "future"}})
            else:
                exch_chart = ccxt.binance({"enableRateLimit": True, "apiKey": cfg_chart.get("exchange", {}).get("api_key"), "secret": cfg_chart.get("exchange", {}).get("secret")})
            exch_chart.load_markets()
            ohlcv_chart = exch_chart.fetch_ohlcv("BTC/USDT", timeframe=btc_tf, limit=200)
            df_chart = pd.DataFrame(ohlcv_chart, columns=["ts", "open", "high", "low", "close", "vol"])
            df_chart["ts"] = pd.to_datetime(df_chart["ts"], unit="ms")
            chart = alt.Chart(df_chart).mark_line().encode(x="ts:T", y="close:Q")
            st.altair_chart(chart, use_container_width=True)
        except Exception as e2:
            st.error(f"价格数据暂不可用: {e2}")

with tab_status:
    if st.session_state.pair_status:
        s_items = list(st.session_state.pair_status.values())
        s_df = pd.DataFrame(s_items)
        s_df = s_df.sort_values(by=["last_ts"], ascending=False)
        st.dataframe(s_df[["symbol", "market_type", "timeframe", "last_ts", "mode", "error"]], use_container_width=True)
    else:
        st.info("正在连接并加载市场数据…")

with tab_history:
    hist_df = pd.DataFrame(st.session_state.history)
    st.dataframe(hist_df, use_container_width=True)
    if not hist_df.empty:
        csv_bytes = hist_df.to_csv(index=False).encode('utf-8')
        st.download_button("导出 CSV", data=csv_bytes, file_name="signals.csv", mime="text/csv")
    if st.button("清空历史信号"):
        st.session_state.history = []

with tab_summary:
    hist_df = pd.DataFrame(st.session_state.history)
    if not hist_df.empty:
        now_ms = int(time.time() * 1000)
        recent_df = hist_df[hist_df["signal_time"] >= now_ms - 3600 * 1000]
        if not recent_df.empty:
            grp1 = recent_df.groupby(["market_type"]).agg(
                count=("symbol", "count"),
                symbols=("symbol", lambda x: ", ".join(sorted(set(x))))
            ).reset_index()
            grp2 = recent_df.groupby(["timeframe"]).agg(
                count=("symbol", "count"),
                symbols=("symbol", lambda x: ", ".join(sorted(set(x))))
            ).reset_index()
            st.subheader("按资产类别")
            st.dataframe(grp1, use_container_width=True)
            st.subheader("按周期")
            st.dataframe(grp2, use_container_width=True)
        else:
            st.info("过去1小时无买入信号")
    else:
        st.info("暂无历史数据")
