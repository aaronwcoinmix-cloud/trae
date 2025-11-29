import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 获取用户算法参数设置
router.get('/algorithm-params', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const { data, error } = await supabase
      .from('algorithm_params')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取算法参数错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取算法参数失败',
        message: error.message 
      });
    }

    // 如果没有用户自定义参数，返回默认参数
    if (!data || data.length === 0) {
      const defaultParams = getDefaultAlgorithmParams();
      return res.json({ 
        success: true, 
        data: defaultParams 
      });
    }

    res.json({ 
      success: true, 
      data: data 
    });
  } catch (error) {
    console.error('获取算法参数异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 更新算法参数
router.post('/algorithm-params', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { algorithm_name, parameters, is_active } = req.body;

    if (!algorithm_name || !parameters) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数' 
      });
    }

    // 验证参数格式
    if (typeof parameters !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '参数格式错误' 
      });
    }

    // 检查是否已存在该算法参数
    const { data: existingParams } = await supabase
      .from('algorithm_params')
      .select('id')
      .eq('user_id', userId)
      .eq('algorithm_name', algorithm_name)
      .single();

    let result;
    if (existingParams) {
      // 更新现有参数
      const { data, error } = await supabase
        .from('algorithm_params')
        .update({
          parameters,
          is_active: is_active !== undefined ? is_active : true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingParams.id)
        .select()
        .single();

      if (error) {
        console.error('更新算法参数错误:', error);
        return res.status(500).json({ 
          success: false, 
          error: '更新算法参数失败',
          message: error.message 
        });
      }

      result = data;
    } else {
      // 创建新参数
      const { data, error } = await supabase
        .from('algorithm_params')
        .insert({
          user_id: userId,
          algorithm_name,
          parameters,
          is_active: is_active !== undefined ? is_active : true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('创建算法参数错误:', error);
        return res.status(500).json({ 
          success: false, 
          error: '创建算法参数失败',
          message: error.message 
        });
      }

      result = data;
    }

    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('更新算法参数异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取用户通知设置
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_settings')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('获取通知设置错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取通知设置失败',
        message: error.message 
      });
    }

    // 返回默认通知设置
    const defaultSettings = getDefaultNotificationSettings();
    const userSettings = user?.notification_settings || defaultSettings;

    res.json({ 
      success: true, 
      data: userSettings 
    });
  } catch (error) {
    console.error('获取通知设置异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 更新通知设置
router.post('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const notificationSettings = req.body;

    if (!notificationSettings || typeof notificationSettings !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '通知设置格式错误' 
      });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        notification_settings: notificationSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('notification_settings')
      .single();

    if (error) {
      console.error('更新通知设置错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '更新通知设置失败',
        message: error.message 
      });
    }

    res.json({ 
      success: true, 
      data: data?.notification_settings 
    });
  } catch (error) {
    console.error('更新通知设置异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取用户订阅信息
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans!inner(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = 未找到记录
      console.error('获取订阅信息错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取订阅信息失败',
        message: error.message 
      });
    }

    // 如果没有活跃订阅，返回免费计划信息
    if (!subscription) {
      const freePlan = await getFreePlanInfo();
      return res.json({ 
        success: true, 
        data: {
          plan: freePlan,
          status: 'free',
          expires_at: null,
          features: getFreePlanFeatures()
        }
      });
    }

    res.json({ 
      success: true, 
      data: subscription 
    });
  } catch (error) {
    console.error('获取订阅信息异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 升级订阅
router.post('/subscription/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { plan_type, payment_method } = req.body;

    if (!plan_type || !['free', 'basic', 'premium', 'professional'].includes(plan_type)) {
      return res.status(400).json({ 
        success: false, 
        error: '无效的订阅计划' 
      });
    }

    // 获取目标计划信息
    const { data: targetPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_type', plan_type)
      .eq('is_active', true)
      .single();

    if (planError || !targetPlan) {
      return res.status(400).json({ 
        success: false, 
        error: '订阅计划不存在或不可用' 
      });
    }

    // 获取当前订阅
    const { data: currentSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    // 计算新订阅的到期时间
    const now = new Date();
    let endDate = new Date();
    
    if (targetPlan.billing_cycle === 'month') {
      endDate.setMonth(now.getMonth() + 1);
    } else if (targetPlan.billing_cycle === 'year') {
      endDate.setFullYear(now.getFullYear() + 1);
    } else if (targetPlan.billing_cycle === 'lifetime') {
      endDate.setFullYear(now.getFullYear() + 100); // 100年作为终身订阅
    }

    // 如果已有活跃订阅，先取消当前订阅
    if (currentSubscription) {
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          updated_at: now.toISOString()
        })
        .eq('id', currentSubscription.id);
    }

    // 创建新订阅
    const { data: newSubscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: targetPlan.id,
        plan_type: targetPlan.plan_type,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        features: targetPlan.features,
        status: 'active',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select(`
        *,
        plan:subscription_plans!inner(*)
      `)
      .single();

    if (subError) {
      console.error('创建订阅错误:', subError);
      return res.status(500).json({ 
        success: false, 
        error: '创建订阅失败',
        message: subError.message 
      });
    }

    // 记录订阅升级活动
    await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        action: '订阅升级',
        details: `从 ${currentSubscription?.plan_type || 'free'} 升级到 ${targetPlan.plan_type}`,
        created_at: now.toISOString()
      });

    res.json({ 
      success: true, 
      data: newSubscription,
      message: '订阅升级成功'
    });

  } catch (error) {
    console.error('订阅升级异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 取消订阅
router.post('/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    // 获取当前活跃订阅
    const { data: currentSubscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !currentSubscription) {
      return res.status(400).json({ 
        success: false, 
        error: '没有找到活跃的订阅' 
      });
    }

    // 更新订阅状态为已取消
    const { data: cancelledSubscription, error: cancelError } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSubscription.id)
      .select(`
        *,
        plan:subscription_plans!inner(*)
      `)
      .single();

    if (cancelError) {
      return res.status(500).json({ 
        success: false, 
        error: '取消订阅失败',
        message: cancelError.message 
      });
    }

    // 记录订阅取消活动
    await supabase
      .from('activity_log')
      .insert({
        user_id: userId,
        action: '订阅取消',
        details: `取消了 ${currentSubscription.plan_type} 订阅`,
        created_at: new Date().toISOString()
      });

    res.json({ 
      success: true, 
      data: cancelledSubscription,
      message: '订阅取消成功，将在当前周期结束后生效'
    });

  } catch (error) {
    console.error('订阅取消异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取可用订阅计划
router.get('/subscription-plans', authenticateToken, async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      console.error('获取订阅计划错误:', error);
      return res.status(500).json({ 
        success: false, 
        error: '获取订阅计划失败',
        message: error.message 
      });
    }

    res.json({ 
      success: true, 
      data: plans || [] 
    });
  } catch (error) {
    console.error('获取订阅计划异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 获取系统配置
router.get('/system-config', authenticateToken, async (req, res) => {
  try {
    const config = {
      system_name: '币安USDT-M合约底部雷达',
      version: '1.0.0',
      max_signals_per_user: 50,
      max_alerts_per_user: 20,
      data_retention_days: 90,
      supported_algorithms: ['market_flow', 'vix_fix'],
      supported_timeframes: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'],
      features: {
        real_time_signals: true,
        backtesting: true,
        alerts: true,
        paper_trading: false,
        api_access: false
      }
    };

    res.json({ 
      success: true, 
      data: config 
    });
  } catch (error) {
    console.error('获取系统配置异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器错误',
      message: (error as Error).message 
    });
  }
});

// 辅助函数：获取默认算法参数
function getDefaultAlgorithmParams() {
  return [
    {
      algorithm_name: 'market_flow',
      parameters: {
        volume_threshold: 1.5,
        price_change_threshold: -0.02,
        time_window: 24,
        min_volume_ratio: 2.0,
        confirmation_periods: 3
      },
      is_active: true
    },
    {
      algorithm_name: 'vix_fix',
      parameters: {
        period: 22,
        bollinger_period: 20,
        bollinger_std_dev: 2.0,
        threshold_low: 0.7,
        threshold_high: 0.3,
        smoothing_period: 3
      },
      is_active: true
    }
  ];
}

// 辅助函数：获取默认通知设置
function getDefaultNotificationSettings() {
  return {
    email_enabled: true,
    browser_enabled: true,
    signal_alerts: true,
    price_alerts: false,
    volume_alerts: false,
    alert_frequency: 'immediate', // immediate, hourly, daily
    quiet_hours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    },
    signal_strength_threshold: 0.6
  };
}

// 辅助函数：获取免费计划信息
async function getFreePlanInfo() {
  return {
    id: 'free',
    name: '免费版',
    description: '基础功能，适合个人用户',
    price: 0,
    currency: 'CNY',
    billing_cycle: 'month',
    max_signals: 10,
    max_alerts: 5,
    features: JSON.stringify(['基础信号', '邮件通知', '基础图表'])
  };
}

// 辅助函数：获取免费计划功能
function getFreePlanFeatures() {
  return {
    max_signals: 10,
    max_alerts: 5,
    real_time_data: true,
    email_notifications: true,
    backtesting: false,
    advanced_charts: false,
    api_access: false,
    priority_support: false
  };
}

export default router;