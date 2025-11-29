import express from 'express';
import { BacktestEngine } from '../algorithms/backtestEngine';
import { supabase } from '../config/supabase';

const router = express.Router();
const backtestEngine = new BacktestEngine();

// 运行回测
router.post('/run', async (req, res) => {
  try {
    const { 
      algorithm, 
      symbol, 
      timeframe, 
      startDate, 
      endDate, 
      initialCapital, 
      positionSize, 
      stopLoss, 
      takeProfit,
      marketFlowParams,
      vixFixParams,
      candles 
    } = req.body;

    // 验证参数
    if (!algorithm || !symbol || !timeframe || !startDate || !endDate) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 运行回测
    const result = await backtestEngine.runBacktest({
      algorithm: algorithm as 'marketFlow' | 'vixFix' | 'combined',
      symbol,
      timeframe,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      initialCapital: initialCapital || 10000,
      positionSize: positionSize || 0.1,
      stopLoss: stopLoss || 0.02,
      takeProfit: takeProfit || 0.05,
      marketFlowParams,
      vixFixParams,
      userId: undefined
    }, Array.isArray(candles) ? candles : undefined);

    // 保存回测结果到数据库
    const { data, error } = await supabase
      .from('backtest_results')
      .insert([{
        user_id: null,
        params: req.body,
        total_trades: result.totalTrades,
        winning_trades: result.winningTrades,
        losing_trades: result.losingTrades,
        win_rate: result.winRate,
        total_return: result.totalReturn,
        max_drawdown: result.maxDrawdown,
        sharpe_ratio: result.sharpeRatio,
        profit_factor: result.profitFactor,
        avg_win: result.avgWin,
        avg_loss: result.avgLoss,
        largest_win: result.largestWin,
        largest_loss: result.largestLoss,
        trades: result.trades,
        equity_curve: result.equityCurve,
        monthly_returns: result.monthlyReturns,
      }])
      .select()
      .single();

    if (error) {
      console.error('保存回测结果失败:', error);
      // 即使保存失败也返回回测结果
      return res.json(result);
    }

    res.json({
      ...result,
      id: data.id,
      createdAt: data.created_at
    });
  } catch (error) {
    console.error('回测执行失败:', error);
    res.status(500).json({ error: '回测执行失败' });
  }
});

// 获取用户的回测历史
router.get('/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, symbol, algorithm } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('backtest_results')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (symbol) {
      query = query.contains('params', { symbol });
    }

    if (algorithm) {
      query = query.contains('params', { algorithm });
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      results: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取回测历史失败:', error);
    res.status(500).json({ error: '获取回测历史失败' });
  }
});

// 获取单个回测结果详情
router.get('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('backtest_results')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: '回测结果不存在' });

    res.json(data);
  } catch (error) {
    console.error('获取回测结果失败:', error);
    res.status(500).json({ error: '获取回测结果失败' });
  }
});

// 删除回测结果
router.delete('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('backtest_results')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ message: '回测结果已删除' });
  } catch (error) {
    console.error('删除回测结果失败:', error);
    res.status(500).json({ error: '删除回测结果失败' });
  }
});

// 获取回测统计信息
router.get('/stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('backtest_results')
      .select('total_return, win_rate, total_trades, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const stats = {
      totalBacktests: data?.length || 0,
      avgReturn: data?.reduce((sum, item) => sum + item.total_return, 0) / (data?.length || 1),
      avgWinRate: data?.reduce((sum, item) => sum + item.win_rate, 0) / (data?.length || 1),
      bestReturn: data?.reduce((max, item) => Math.max(max, item.total_return), 0) || 0,
      worstReturn: data?.reduce((min, item) => Math.min(min, item.total_return), 0) || 0,
      recentTrend: data?.slice(0, 10).map(item => item.total_return) || []
    };

    res.json(stats);
  } catch (error) {
    console.error('获取回测统计失败:', error);
    res.status(500).json({ error: '获取回测统计失败' });
  }
});

// 批量回测（用于参数优化）
router.post('/batch', async (req, res) => {
  try {
    const { 
      symbol, 
      timeframe, 
      startDate, 
      endDate, 
      initialCapital,
      parameterRanges 
    } = req.body;

    if (!symbol || !timeframe || !startDate || !endDate || !parameterRanges) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 执行批量回测
    const results = await backtestEngine.runBatchBacktest({
      symbol,
      timeframe,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      initialCapital: initialCapital || 10000,
      parameterRanges,
      userId: undefined
    });

    res.json({
      results,
      bestParameters: results.reduce((best, current) => 
        current.totalReturn > best.totalReturn ? current : best
      ),
      totalCombinations: results.length
    });
  } catch (error) {
    console.error('批量回测失败:', error);
    res.status(500).json({ error: '批量回测失败' });
  }
});

export default router;
