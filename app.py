from pathlib import Path
import json
from datetime import datetime, timedelta
import uuid
from difflib import SequenceMatcher
import streamlit as st
import pandas as pd
import requests
import yfinance as yf
import plotly.graph_objects as go

DATA_FILE = Path(__file__).parent / "trading_data.json"

def load_data():
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_data(entries):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

def add_entry(entry):
    entries = load_data()
    entries.append(entry)
    save_data(entries)

def analyze_input(market_obs, trade_thesis):
    points = []
    text = (market_obs or "") + "\n" + (trade_thesis or "")
    bull_keys = ["看涨", "做多", "多头", "买入"]
    bear_keys = ["看跌", "做空", "空头", "卖出"]
    is_bull = any(k in trade_thesis for k in bull_keys)
    is_bear = any(k in trade_thesis for k in bear_keys)
    if not is_bull and not is_bear:
        points.append("未明确方向。建议明确是看涨还是看跌，并给出触发条件。")
    if is_bull:
        points.append("看涨思路：确认趋势与成交量是否同步，避免在关键阻力位盲目做多。")
        points.append("关注宏观与事件风险（利率、政策、财报），防范预期差导致的回撤。")
    if is_bear:
        points.append("看跌思路：明确做空风险（逼空、借券成本、波动性上升），避免在强支撑位追空。")
        points.append("观察市场流动性与持仓结构，防范突发消息引发的剧烈反弹。")
    if "止损" not in text and "stop" not in text.lower():
        points.append("未提及止损。建议设定具体止损位与风控规则（如最大亏损比例）。")
    if "目标" not in text and "盈利" not in text and "止盈" not in text:
        points.append("未设定盈利目标或风险收益比。建议明确R/R与分批止盈策略。")
    if not any(k in text for k in ["催化", "事件", "数据", "财报", "宏观", "消息"]):
        points.append("未识别关键催化。补充可能影响方向的事件与数据时间表。")
    if not any(k in text for k in ["流动性", "成交量", "换手率"]):
        points.append("未评估流动性。建议观察成交量与资金结构，确认可执行性。")
    if len(trade_thesis.strip()) < 20:
        points.append("交易思路较为简略。补充入场触发、无效化条件、仓位管理与复盘标准。")
    points.append("建议形成可验证的假设—证据—行动框架，并记录执行结果以持续迭代。")
    rag = rag_repetition_summary(market_obs, trade_thesis)
    joined = "\n".join([f"- {p}" for p in points])
    if rag:
        joined += "\n\n" + "历史检索与重复错误" + "\n" + rag
    return joined

CRYPTO_KEYS = [
    "BTC","比特币","ETH","以太","山寨","Alt","加密","链上","资金费率","Funding",
    "合约","永续","杠杆","仓位","波动","流动性","爆仓","清算","ETF","减半","手续费","Gas",
    "稳定币","USDT","USDC","期权","Gamma","市值","Dominance","周末","Open Interest","OI",
    "Staking","跨链","L2","Solana","币安","Binance","OKX","火币","趋势","动量","突破",
    "回撤","支撑","阻力","情绪","FOMO","利好","利空"
]

def issue_tags(text, is_bull, is_bear):
    tags = set()
    t = text.lower()
    if ("止损" not in text) and ("stop" not in t):
        tags.add("未提及止损")
    if ("目标" not in text) and ("盈利" not in text) and ("止盈" not in text):
        tags.add("未设定盈利目标")
    if not any(k in text for k in ["催化","事件","数据","财报","宏观","消息"]):
        tags.add("未识别关键催化")
    if not any(k in text for k in ["流动性","成交量","换手率"]):
        tags.add("未评估流动性")
    if is_bull:
        tags.add("做多风险审视不足")
    if is_bear:
        tags.add("做空风险审视不足")
    if len(text.strip()) < 20:
        tags.add("论述过于简略")
    return tags

def recent_entries(days=30):
    entries = load_data()
    cutoff = datetime.now() - timedelta(days=days)
    recent = []
    for e in entries:
        dt = e.get("datetime")
        try:
            if dt:
                d = datetime.fromisoformat(dt)
                if d >= cutoff:
                    recent.append(e)
        except Exception:
            continue
    return recent

def text_similarity(a, b):
    ra = SequenceMatcher(None, a, b).ratio()
    ka = set(k.lower() for k in CRYPTO_KEYS if k.lower() in a.lower())
    kb = set(k.lower() for k in CRYPTO_KEYS if k.lower() in b.lower())
    kw = 0.5 if ka or kb else 0.0
    inter = len(ka & kb)
    union = len(ka | kb) if (ka or kb) else 1
    jacc = inter / union
    return 0.6 * ra + kw * (0.4 * jacc)

def rag_repetition_summary(market_obs, trade_thesis):
    recents = recent_entries(30)
    if not recents:
        return "- 过去30天暂无可检索记录。"
    cur_text = (market_obs or "") + "\n" + (trade_thesis or "")
    bull_keys = ["看涨","做多","多头","买入"]
    bear_keys = ["看跌","做空","空头","卖出"]
    is_bull = any(k in (trade_thesis or "") for k in bull_keys)
    is_bear = any(k in (trade_thesis or "") for k in bear_keys)
    cur_tags = issue_tags(cur_text, is_bull, is_bear)
    sims = []
    for e in recents:
        prev_text = (e.get("market_observation","")) + "\n" + (e.get("trade_thesis",""))
        s = text_similarity(cur_text, prev_text)
        sims.append((s, e))
    sims.sort(key=lambda x: x[0], reverse=True)
    top = sims[:3]
    tag_counts = {}
    for e in recents:
        pt = (e.get("market_observation","")) + "\n" + (e.get("trade_thesis",""))
        pbull = any(k in e.get("trade_thesis","") for k in bull_keys)
        pbear = any(k in e.get("trade_thesis","") for k in bear_keys)
        for t in issue_tags(pt, pbull, pbear):
            tag_counts[t] = tag_counts.get(t, 0) + 1
    repeated = []
    for t in sorted(tag_counts, key=lambda k: tag_counts[k], reverse=True):
        if tag_counts[t] >= 2:
            repeated.append(f"- 过去30天中出现 {tag_counts[t]} 次：{t}")
    lines = []
    if repeated:
        lines.extend(repeated)
    else:
        lines.append("- 未发现明显的重复错误模式。继续保持规范记录与复盘。")
    if top:
        lines.append("- 相似记录参考：")
        for s, e in top:
            first_line = (e.get("ai_analysis"," ").split("\n")[0]).lstrip("- ")
            lines.append(f"  • {e.get('date_str','')} 相似度 {s:.2f}：{first_line}")
    return "\n".join(lines)

def btc_detected(text):
    t = (text or "").lower()
    return ("btc" in t) or ("比特币" in t) or ("bitcoin" in t)

def fetch_btc_klines_yf():
    try:
        df = yf.Ticker("BTC-USD").history(period="1d", interval="5m")
        if isinstance(df, pd.DataFrame) and not df.empty:
            df = df.reset_index()
            df.rename(columns={"Datetime": "time"}, inplace=True)
            return df
    except Exception:
        pass
    return None

def fetch_btc_klines_binance():
    try:
        url = "https://api.binance.com/api/v3/klines"
        params = {"symbol": "BTCUSDT", "interval": "5m", "limit": 200}
        r = requests.get(url, params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            rows = []
            for k in data:
                rows.append({
                    "time": datetime.fromtimestamp(k[0] / 1000),
                    "Open": float(k[1]),
                    "High": float(k[2]),
                    "Low": float(k[3]),
                    "Close": float(k[4]),
                    "Volume": float(k[5]),
                })
            return pd.DataFrame(rows)
    except Exception:
        pass
    return None

def build_candle_figure(df):
    fig = go.Figure(data=[go.Candlestick(x=df["time"],
                                         open=df["Open"],
                                         high=df["High"],
                                         low=df["Low"],
                                         close=df["Close"] )])
    fig.update_layout(margin=dict(l=10, r=10, t=30, b=10), height=360)
    return fig

def show_btc_chart_and_metrics(market_obs, trade_thesis):
    text = (market_obs or "") + "\n" + (trade_thesis or "")
    if not btc_detected(text):
        return
    st.subheader("BTC 今日K线与涨跌幅")
    df = fetch_btc_klines_yf()
    if df is None or df.empty:
        df = fetch_btc_klines_binance()
    if df is None or df.empty:
        st.info("未能获取BTC数据，请稍后重试。")
        return
    fig = build_candle_figure(df)
    st.plotly_chart(fig, use_container_width=True)
    try:
        first_open = float(df.iloc[0]["Open"])
        last_close = float(df.iloc[-1]["Close"])
        change_pct = (last_close - first_open) / first_open * 100.0
        st.metric(label="最新价格(USD)", value=f"{last_close:.2f}", delta=f"{change_pct:.2f}%")
    except Exception:
        pass

st.set_page_config(page_title="交易员个人成长系统", layout="wide")
st.title("交易员个人成长系统")

col_left, col_right = st.columns(2)

with col_left:
    st.header("每日记录")
    market_obs = st.text_area("市场观察", height=150, key="market_obs")
    trade_thesis = st.text_area("我的交易思路", height=150, key="trade_thesis")
    submitted = st.button("提交")
    if submitted:
        if not market_obs.strip() and not trade_thesis.strip():
            st.warning("请至少填写‘市场观察’或‘我的交易思路’。")
        else:
            analysis = analyze_input(market_obs, trade_thesis)
            now = datetime.now()
            entry = {
                "id": str(uuid.uuid4()),
                "datetime": now.isoformat(timespec="seconds"),
                "date_str": now.strftime("%Y-%m-%d %H:%M"),
                "market_observation": market_obs.strip(),
                "trade_thesis": trade_thesis.strip(),
                "ai_analysis": analysis,
            }
            add_entry(entry)
            st.success("已保存并生成AI点评")
            st.subheader("AI 分析师点评")
            st.markdown(analysis)
            show_btc_chart_and_metrics(market_obs, trade_thesis)

with col_right:
    st.header("历史记录")
    entries = load_data()
    if not entries:
        st.info("暂无历史记录")
    else:
        try:
            entries = sorted(entries, key=lambda e: e.get("datetime", ""), reverse=True)
        except Exception:
            pass
        for e in entries:
            header = f"{e.get('date_str', '')}"
            with st.expander(header):
                st.markdown(f"**市场观察**\n\n{e.get('market_observation','')}")
                st.markdown(f"**我的交易思路**\n\n{e.get('trade_thesis','')}")
                st.markdown(f"**AI 点评**\n\n{e.get('ai_analysis','')}")
