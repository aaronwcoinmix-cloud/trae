import express from 'express';
import axios from 'axios';

const router = express.Router();

// 后端外网连通性诊断（Binance Futures 公网）
router.get('/diagnostics', async (req, res) => {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: [] as Array<{ name: string; ok: boolean; error?: any; duration_ms: number }>,
  };

  async function check(name: string, fn: () => Promise<any>) {
    const start = Date.now();
    try {
      const r = await fn();
      results.checks.push({ name, ok: true, duration_ms: Date.now() - start });
      return r;
    } catch (error: any) {
      results.checks.push({
        name,
        ok: false,
        duration_ms: Date.now() - start,
        error: {
          code: error?.code,
          message: error?.message,
          axios_url: error?.config?.url,
        },
      });
    }
  }

  // 1) Binance Futures 时间接口
  await check('binance_futures_time', async () => {
    return axios.get('https://fapi.binance.com/fapi/v1/time', { timeout: 5000 });
  });

  // 2) 24h ticker（BTCUSDT）
  await check('binance_futures_24hr_ticker', async () => {
    return axios.get('https://fapi.binance.com/fapi/v1/ticker/24hr', {
      params: { symbol: 'BTCUSDT' },
      timeout: 5000,
    });
  });

  // 3) K线示例（BTCUSDT 1h 5条）
  await check('binance_futures_klines', async () => {
    return axios.get('https://fapi.binance.com/fapi/v1/klines', {
      params: { symbol: 'BTCUSDT', interval: '1h', limit: 5 },
      timeout: 5000,
    });
  });

  const ok = results.checks.every((c) => c.ok);
  res.json({ success: ok, ...results });
});

export default router;
