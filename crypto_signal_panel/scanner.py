import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import yaml
import pandas as pd

from crypto_signal_panel.strategy import StrategyState, compute_signal
from crypto_signal_panel.utils import ohlcv_to_df


try:
    import ccxt.pro as ccxtpro  # type: ignore
except Exception:
    ccxtpro = None
import ccxt


@dataclass
class PairState:
    symbol: str
    timeframe: str
    market_type: str  # spot or futures
    state: StrategyState = field(default_factory=StrategyState)
    ohlcv: List[List[float]] = field(default_factory=list)
    last_closed_ts: Optional[int] = None


class SignalScanner:
    def __init__(self, config: Dict):
        self.config = config
        self.exchange_name = config.get("exchange", {}).get("name", "binance")
        self.exchange_type = config.get("exchange", {}).get("type", "both")
        self.use_ccxt_pro = bool(config.get("exchange", {}).get("use_ccxt_pro", True))
        self.api_key = config.get("exchange", {}).get("api_key", None)
        self.secret = config.get("exchange", {}).get("secret", None)

        self.timeframes: List[str] = config.get("timeframes", ["1h", "4h", "1d"])
        whitelist: List[str] = config.get("symbols", {}).get("whitelist", [])
        blacklist: List[str] = config.get("symbols", {}).get("blacklist", [])

        # Load markets and build symbol list
        self.exchange_spot = None
        self.exchange_futures = None
        self.pairs: List[PairState] = []

        self.whitelist = [s for s in whitelist if s not in blacklist]
        self.history: List[Dict] = []
        self.mode: str = "rest"

    async def _init_exchanges(self):
        if self.use_ccxt_pro and ccxtpro is not None:
            self.exchange_spot = ccxtpro.binance({"apiKey": self.api_key, "secret": self.secret})
            self.exchange_futures = ccxtpro.binance({"apiKey": self.api_key, "secret": self.secret, "options": {"defaultType": "future"}})
            self.mode = "websocket"
        else:
            self.exchange_spot = ccxt.binance({"apiKey": self.api_key, "secret": self.secret})
            self.exchange_futures = ccxt.binance({"apiKey": self.api_key, "secret": self.secret, "options": {"defaultType": "future"}})
            self.mode = "rest"

        await self._load_markets()

    async def _load_markets(self):
        if hasattr(self.exchange_spot, "load_markets"):
            if asyncio.iscoroutinefunction(self.exchange_spot.load_markets):
                await self.exchange_spot.load_markets()
            else:
                self.exchange_spot.load_markets()
        if hasattr(self.exchange_futures, "load_markets"):
            if asyncio.iscoroutinefunction(self.exchange_futures.load_markets):
                await self.exchange_futures.load_markets()
            else:
                self.exchange_futures.load_markets()

        # Build pairs
        for sym in self.whitelist:
            for tf in self.timeframes:
                self.pairs.append(PairState(symbol=sym, timeframe=tf, market_type="spot"))
                if self.exchange_type in ("both", "futures"):
                    self.pairs.append(PairState(symbol=sym, timeframe=tf, market_type="futures"))

    async def _watch_pair(self, pair: PairState, signal_queue, status_queue):
        exch = self.exchange_spot if pair.market_type == "spot" else self.exchange_futures
        try:
            while True:
                if self.use_ccxt_pro and ccxtpro is not None and hasattr(exch, "watchOHLCV"):
                    ohlcv = await exch.watchOHLCV(pair.symbol, timeframe=pair.timeframe)
                else:
                    ohlcv = await asyncio.to_thread(exch.fetch_ohlcv, pair.symbol, timeframe=pair.timeframe, limit=500)

                if not ohlcv:
                    await asyncio.sleep(0.1)
                    continue

                df = ohlcv_to_df(ohlcv)
                # Identify closed candle
                last_ts = int(df.index[-1])
                if pair.last_closed_ts is None or last_ts > pair.last_closed_ts:
                    pair.last_closed_ts = last_ts
                    pair.ohlcv = ohlcv
                    status_queue.put({
                        "symbol": pair.symbol,
                        "market_type": pair.market_type,
                        "timeframe": pair.timeframe,
                        "last_ts": last_ts,
                        "mode": self.mode,
                    })
                    sig = compute_signal(df, pair.state)
                    if sig["long_condition"]:
                        signal_queue.put({
                            "symbol": pair.symbol,
                            "market_type": pair.market_type,
                            "timeframe": pair.timeframe,
                            "signal_time": last_ts,
                            "current_price": float(df["close"].iat[-1]),
                            "bars_since": sig["bars_since"],
                            "upper_target": sig["tp_target"],
                            "atr_stop": sig["sl_price"],
                            "strength": sig["chips_value"],
                        })
                await asyncio.sleep(0)
        except Exception as e:
            status_queue.put({
                "symbol": pair.symbol,
                "market_type": pair.market_type,
                "timeframe": pair.timeframe,
                "error": str(e),
                "mode": self.mode,
            })
            await asyncio.sleep(1)

    async def run(self, signal_queue, status_queue):
        await self._init_exchanges()
        for p in self.pairs:
            status_queue.put({
                "symbol": p.symbol,
                "market_type": p.market_type,
                "timeframe": p.timeframe,
                "last_ts": None,
                "mode": self.mode,
                "error": None,
            })
        tasks = [asyncio.create_task(self._watch_pair(p, signal_queue, status_queue)) for p in self.pairs]
        await asyncio.gather(*tasks)


def load_config(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
