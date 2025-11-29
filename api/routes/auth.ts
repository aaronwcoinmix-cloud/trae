import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin as supabaseServer } from '../config/supabase';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 验证输入
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: '请提供完整的注册信息'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码长度至少为6位'
      });
    }

    // 检查邮箱是否已存在
    const { data: existingUser } = await supabaseServer
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        name,
        role: 'user',
        settings: {}
      }])
      .select()
      .single();

    if (userError) {
      throw userError;
    }

    // 创建免费订阅
    const { data: subscription } = await supabaseServer
      .from('subscriptions')
      .insert([{
        user_id: user.id,
        plan_type: 'free',
        features: {
          max_signals: 50,
          backtest_days: 7,
          alert_enabled: true
        }
      }])
      .select()
      .single();

    // 创建用户设置
    await supabaseServer
      .from('user_settings')
      .insert([{
        user_id: user.id,
        alert_enabled: true,
        alert_signal_strength: 'medium',
        alert_notification_methods: ['browser'],
        alert_frequency: 'realtime'
      }]);

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 返回用户信息（不包含密码）
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      subscription
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      error: '注册失败，请稍后重试'
    });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 验证输入
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '请提供邮箱和密码'
      });
    }

    // 查找用户
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 获取用户订阅信息
    const { data: subscription } = await supabaseServer
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 返回用户信息（不包含密码）
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
      subscription
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      error: '登录失败，请稍后重试'
    });
  }
});

// 验证令牌
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: '请提供令牌'
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 查找用户
    const { data: user, error } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: '令牌无效或用户不存在'
      });
    }

    // 获取用户订阅信息
    const { data: subscription } = await supabaseServer
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    // 返回用户信息（不包含密码）
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      user: userWithoutPassword,
      subscription
    });

  } catch (error) {
    console.error('令牌验证错误:', error);
    res.status(401).json({
      success: false,
      error: '令牌无效'
    });
  }
});

// 获取用户资料
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    // 获取用户信息
    const { data: user, error: userError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(500).json({
        success: false,
        error: '获取用户信息失败'
      });
    }

    // 获取用户订阅信息
    const { data: subscription, error: subError } = await supabaseServer
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans!inner(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    // 构建用户资料数据
    const userProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || null,
      avatar_url: user.avatar_url || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
      subscription_plan: subscription?.plan?.plan_type || 'free',
      subscription_status: subscription?.status || 'inactive',
      subscription_expires_at: subscription?.expires_at || null,
      max_signals_per_day: subscription?.plan?.max_signals_per_day || 50,
      max_backtests_per_month: subscription?.plan?.max_backtests_per_month || 10,
      realtime_updates: subscription?.plan?.features?.real_time_data || false,
      advanced_analytics: subscription?.plan?.features?.advanced_analytics || false
    };

    res.json({
      success: true,
      data: userProfile
    });

  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({
      success: false,
      error: '获取用户资料失败'
    });
  }
});

// 更新用户资料
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { name, phone, email } = req.body;

    // 验证输入
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: '姓名和邮箱不能为空'
      });
    }

    // 检查邮箱是否已被其他用户使用
    if (email) {
      const { data: existingUser } = await supabaseServer
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: '该邮箱已被其他用户使用'
        });
      }
    }

    // 更新用户信息
    const updateData: any = {
      name,
      phone: phone || null,
      updated_at: new Date().toISOString()
    };

    if (email) {
      updateData.email = email;
    }

    const { data: updatedUser, error } = await supabaseServer
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: '更新用户信息失败'
      });
    }

    // 获取更新后的用户资料
    const { data: subscription } = await supabaseServer
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans!inner(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const userProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone || null,
      avatar_url: updatedUser.avatar_url || null,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      subscription_plan: subscription?.plan?.plan_type || 'free',
      subscription_status: subscription?.status || 'inactive',
      subscription_expires_at: subscription?.expires_at || null,
      max_signals_per_day: subscription?.plan?.max_signals_per_day || 50,
      max_backtests_per_month: subscription?.plan?.max_backtests_per_month || 10,
      realtime_updates: subscription?.plan?.features?.real_time_data || false,
      advanced_analytics: subscription?.plan?.features?.advanced_analytics || false
    };

    res.json({
      success: true,
      data: userProfile
    });

  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({
      success: false,
      error: '更新用户资料失败'
    });
  }
});

// 获取用户使用统计
router.get('/usage-stats', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    // 获取用户生成的信号数量
    const { count: signalsCount } = await supabaseServer
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 获取用户运行的回测数量
    const { count: backtestsCount } = await supabaseServer
      .from('backtest_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 获取用户交易记录统计
    const { data: trades } = await supabaseServer
      .from('backtest_results')
      .select('trades')
      .eq('user_id', userId);

    let totalTrades = 0;
    let totalProfit = 0;
    let winningTrades = 0;

    if (trades && trades.length > 0) {
      trades.forEach(result => {
        if (result.trades && Array.isArray(result.trades)) {
          totalTrades += result.trades.length;
          result.trades.forEach((trade: any) => {
            if (trade.pnl) {
              totalProfit += trade.pnl;
              if (trade.pnl > 0) winningTrades++;
            }
          });
        }
      });
    }

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // 获取用户最后活动时间
    const { data: lastActivity } = await supabaseServer
      .from('activity_log')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const usageStats = {
      signals_generated: signalsCount || 0,
      backtests_run: backtestsCount || 0,
      total_trades: totalTrades,
      win_rate: winRate,
      total_profit: totalProfit,
      last_active: lastActivity?.created_at || new Date().toISOString()
    };

    res.json({
      success: true,
      data: usageStats
    });

  } catch (error) {
    console.error('获取使用统计错误:', error);
    res.status(500).json({
      success: false,
      error: '获取使用统计失败'
    });
  }
});

// 获取用户活动日志
router.get('/activity-log', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    
    const { data: activities, error } = await supabaseServer
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({
        success: false,
        error: '获取活动日志失败'
      });
    }

    res.json({
      success: true,
      data: activities || []
    });

  } catch (error) {
    console.error('获取活动日志错误:', error);
    res.status(500).json({
      success: false,
      error: '获取活动日志失败'
    });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码长度至少为6位'
      });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // 更新用户密码
    const { error } = await supabaseServer
      .from('users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: '修改密码失败'
      });
    }

    // 记录密码修改活动
    await supabaseServer
      .from('activity_log')
      .insert({
        user_id: userId,
        action: '密码修改',
        details: '用户修改了账户密码',
        created_at: new Date().toISOString()
      });

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      error: '修改密码失败'
    });
  }
});

// 删除账户
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    // 开始事务处理，删除用户相关数据
    const { error: deleteError } = await supabaseServer
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        error: '删除账户失败'
      });
    }

    // 删除用户订阅
    await supabaseServer
      .from('subscriptions')
      .delete()
      .eq('user_id', userId);

    // 删除用户设置
    await supabaseServer
      .from('user_settings')
      .delete()
      .eq('user_id', userId);

    // 删除算法参数
    await supabaseServer
      .from('algorithm_params')
      .delete()
      .eq('user_id', userId);

    // 删除活动日志
    await supabaseServer
      .from('activity_log')
      .delete()
      .eq('user_id', userId);

    res.json({
      success: true,
      message: '账户删除成功'
    });

  } catch (error) {
    console.error('删除账户错误:', error);
    res.status(500).json({
      success: false,
      error: '删除账户失败'
    });
  }
});

export default router;