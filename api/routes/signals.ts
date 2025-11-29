import express from 'express';
import { supabaseServer } from '../../src/utils/supabase-server';

const router = express.Router();

// 获取实时信号
router.get('/realtime', async (req, res) => {
  try {
    const { limit = 50, strength = 'all' } = req.query;
    
    let query = supabaseServer
      .from('signals')
      .select(`
        *,
        symbols!inner(*)
      `)
      .order('triggered_at', { ascending: false })
      .limit(Number(limit));

    // 根据强度筛选
    if (strength !== 'all') {
      const strengthMap = {
        'strong': { min: 0.7, max: 1.0 },
        'medium': { min: 0.4, max: 0.7 },
        'weak': { min: 0.0, max: 0.4 }
      };
      
      const range = strengthMap[strength as keyof typeof strengthMap];
      if (range) {
        query = query.gte('strength', range.min).lt('strength', range.max);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // 格式化数据
    const signals = data?.map(item => ({
      id: item.id,
      symbol: item.symbol,
      signal_type: item.signal_type,
      strength: item.strength,
      indicators: item.indicators,
      confidence_score: item.confidence_score,
      triggered_at: item.triggered_at,
      metadata: item.metadata,
      created_at: item.created_at
    })) || [];

    res.json({
      success: true,
      signals,
      total: signals.length,
      lastUpdate: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取信号错误:', error);
    res.status(500).json({
      success: false,
      error: '获取信号失败'
    });
  }
});

// 获取特定交易对的信号历史
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startTime, endTime, interval = '1h' } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: '请提供开始和结束时间'
      });
    }

    const { data, error } = await supabaseServer
      .from('signals')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .gte('triggered_at', new Date(Number(startTime)).toISOString())
      .lte('triggered_at', new Date(Number(endTime)).toISOString())
      .order('triggered_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: data || [],
      symbol: symbol.toUpperCase(),
      interval
    });

  } catch (error) {
    console.error('获取信号历史错误:', error);
    res.status(500).json({
      success: false,
      error: '获取信号历史失败'
    });
  }
});

// 创建新信号（内部使用）
router.post('/create', async (req, res) => {
  try {
    const { symbol, signal_type, strength, indicators, confidence_score, metadata } = req.body;

    // 验证输入
    if (!symbol || !signal_type || strength === undefined) {
      return res.status(400).json({
        success: false,
        error: '请提供完整的信号信息'
      });
    }

    // 验证信号类型
    if (!['buy', 'sell', 'hold'].includes(signal_type)) {
      return res.status(400).json({
        success: false,
        error: '无效的信号类型'
      });
    }

    // 验证强度范围
    if (strength < 0 || strength > 1) {
      return res.status(400).json({
        success: false,
        error: '信号强度必须在0-1之间'
      });
    }

    // 验证置信度范围
    if (confidence_score !== undefined && (confidence_score < 0 || confidence_score > 1)) {
      return res.status(400).json({
        success: false,
        error: '置信度必须在0-1之间'
      });
    }

    // 创建信号
    const { data, error } = await supabaseServer
      .from('signals')
      .insert([{
        symbol: symbol.toUpperCase(),
        signal_type,
        strength,
        indicators: indicators || {},
        confidence_score: confidence_score || strength,
        metadata: metadata || {}
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('创建信号错误:', error);
    res.status(500).json({
      success: false,
      error: '创建信号失败'
    });
  }
});

// 获取信号统计
router.get('/stats', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // 计算时间范围
    const now = new Date();
    const startTime = new Date();
    
    switch (timeframe) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(now.getHours() - 6);
        break;
      case '12h':
        startTime.setHours(now.getHours() - 12);
        break;
      case '24h':
      default:
        startTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
    }

    // 获取信号统计
    const { data, error } = await supabaseServer
      .from('signals')
      .select('signal_type, strength, confidence_score')
      .gte('triggered_at', startTime.toISOString());

    if (error) {
      throw error;
    }

    const signals = data || [];
    
    // 计算统计信息
    const stats = {
      total: signals.length,
      buy: signals.filter(s => s.signal_type === 'buy').length,
      sell: signals.filter(s => s.signal_type === 'sell').length,
      hold: signals.filter(s => s.signal_type === 'hold').length,
      strong: signals.filter(s => s.strength >= 0.7).length,
      medium: signals.filter(s => s.strength >= 0.4 && s.strength < 0.7).length,
      weak: signals.filter(s => s.strength < 0.4).length,
      avgStrength: signals.length > 0 ? signals.reduce((sum, s) => sum + s.strength, 0) / signals.length : 0,
      avgConfidence: signals.length > 0 ? signals.reduce((sum, s) => sum + s.confidence_score, 0) / signals.length : 0,
      timeframe,
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取信号统计错误:', error);
    res.status(500).json({
      success: false,
      error: '获取信号统计失败'
    });
  }
});

export default router;