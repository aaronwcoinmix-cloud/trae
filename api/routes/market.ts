import express from 'express';
import { supabase } from '../config/supabase';
import { binanceService } from '../services/binanceService';

const router = express.Router();

// 获取所有交易对
router.get('/symbols', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('symbols')
      .select('*')
      .order('symbol', { ascending: true });

    if (error) {
      console.error('获取交易对错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取交易对失败',
        message: error.message 
      });
    }

    res.json({ 
      success: true, 
      data: data || [] 
    });
  } catch (error) {
    console.error('获取交易对异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取指定交易对的实时价格
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const { data, error } = await supabase
      .from('symbols')
      .select('current_price, price_change_24h, price_change_percent_24h, volume_24h, last_updated')
      .eq('symbol', symbol)
      .single();

    if (error) {
      console.error('获取价格错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取价格失败',
        message: error.message 
      });
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: '交易对不存在' 
      });
    }

    res.json({ 
      success: true, 
      data 
    });
  } catch (error) {
    console.error('获取价格异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取市场概览数据
router.get('/overview', async (req, res) => {
  try {
    const { data: symbols, error } = await supabase
      .from('symbols')
      .select('symbol, current_price, price_change_percent_24h, volume_24h, last_updated')
      .order('volume_24h', { ascending: false })
      .limit(50);

    if (error) {
      console.error('获取市场概览错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取市场概览失败',
        message: error.message 
      });
    }

    // 计算市场统计
    const totalSymbols = symbols?.length || 0;
    const positiveChange = symbols?.filter(s => (s.price_change_percent_24h || 0) > 0).length || 0;
    const negativeChange = symbols?.filter(s => (s.price_change_percent_24h || 0) < 0).length || 0;
    const totalVolume = symbols?.reduce((sum, s) => sum + (s.volume_24h || 0), 0) || 0;

    res.json({ 
      success: true, 
      data: {
        symbols: symbols || [],
        statistics: {
          total_symbols: totalSymbols,
          positive_change: positiveChange,
          negative_change: negativeChange,
          neutral_change: totalSymbols - positiveChange - negativeChange,
          total_volume_24h: totalVolume
        }
      }
    });
  } catch (error) {
    console.error('获取市场概览异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取热门信号交易对
router.get('/hot-signals', async (req, res) => {
  try {
    const { data: signals, error } = await supabase
      .from('signals')
      .select(`
        *,
        symbol:symbols!inner(
          symbol,
          current_price,
          price_change_percent_24h,
          volume_24h
        )
      `)
      .eq('status', 'active')
      .gte('strength', 0.7)
      .order('strength', { ascending: false })
      .limit(20);

    if (error) {
      console.error('获取热门信号错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取热门信号失败',
        message: error.message 
      });
    }

    res.json({ 
      success: true, 
      data: signals || [] 
    });
  } catch (error) {
    console.error('获取热门信号异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取交易对历史K线数据（模拟数据）
router.get('/kline/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = '100' } = req.query;

    const klines = await binanceService.getKlines(symbol.toUpperCase(), interval as string, parseInt(limit as string));
    const formatted = klines.map(k => ({
      timestamp: k.openTime,
      open: parseFloat(k.open),
      high: parseFloat(k.high),
      low: parseFloat(k.low),
      close: parseFloat(k.close),
      volume: parseFloat(k.volume)
    }));

    res.json({ 
      success: true, 
      data: formatted 
    });
  } catch (error) {
    console.error('获取K线数据异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 新增：市场数据总览（用于前端实时价格表）
router.get('/data', async (req, res) => {
  try {
    const { data: symbols, error } = await supabase
      .from('symbols')
      .select('symbol, current_price, price_change_percent_24h, volume_24h, last_updated')
      .eq('is_active', true)
      .order('volume_24h', { ascending: false })
      .limit(20);

    if (error) {
      console.error('获取市场数据错误:', error);
      return res.status(500).json({ success: false, error: '获取市场数据失败', message: error.message });
    }

    const payload = (symbols || []).map(s => ({
      symbol: s.symbol,
      price: s.current_price || 0,
      price_change_percent: s.price_change_percent_24h || 0,
      volume: s.volume_24h || 0,
      volume_change: 0,
      last_updated: s.last_updated
    }));

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error('获取市场数据异常:', error);
    res.status(500).json({ success: false, error: '服务器错误', message: (error as Error).message });
  }
});

// 生成模拟K线数据
// 移除模拟K线辅助函数，改为使用真实Binance数据

export default router;
