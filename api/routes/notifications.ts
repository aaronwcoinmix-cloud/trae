import express from 'express';
import { supabase } from '../config/supabase';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// 获取用户通知历史
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, is_read } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (type) {
      query = query.eq('type', type);
    }

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('获取通知历史失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取通知历史失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取通知历史异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取未读通知数量
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('获取未读通知数量失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取未读通知数量失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      data: { unread_count: count || 0 }
    });
  } catch (error) {
    console.error('获取未读通知数量异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 标记通知为已读
router.patch('/mark-as-read/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('标记通知为已读失败:', error);
      return res.status(500).json({
        success: false,
        error: '标记通知为已读失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      message: '通知已标记为已读'
    });
  } catch (error) {
    console.error('标记通知为已读异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 标记所有通知为已读
router.patch('/mark-all-as-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('标记所有通知为已读失败:', error);
      return res.status(500).json({
        success: false,
        error: '标记所有通知为已读失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      message: '所有通知已标记为已读'
    });
  } catch (error) {
    console.error('标记所有通知为已读异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 删除通知
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('删除通知失败:', error);
      return res.status(500).json({
        success: false,
        error: '删除通知失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      message: '通知已删除'
    });
  } catch (error) {
    console.error('删除通知异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 清空所有通知
router.delete('/clear-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('清空通知失败:', error);
      return res.status(500).json({
        success: false,
        error: '清空通知失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      message: '所有通知已清空'
    });
  } catch (error) {
    console.error('清空通知异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 获取通知偏好设置
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('获取通知偏好失败:', error);
      return res.status(500).json({
        success: false,
        error: '获取通知偏好失败',
        message: error.message
      });
    }

    // 如果没有设置，返回默认偏好
    const defaultPreferences = {
      signal_notifications: true,
      system_notifications: true,
      browser_notifications: true,
      email_notifications: false,
      signal_types: ['buy', 'sell'],
      min_signal_strength: 0.6,
      quiet_hours: { enabled: false, start: '22:00', end: '08:00' }
    };

    res.json({
      success: true,
      data: data || { user_id: userId, ...defaultPreferences }
    });
  } catch (error) {
    console.error('获取通知偏好异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 更新通知偏好设置
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('更新通知偏好失败:', error);
      return res.status(500).json({
        success: false,
        error: '更新通知偏好失败',
        message: error.message
      });
    }

    res.json({
      success: true,
      data,
      message: '通知偏好已更新'
    });
  } catch (error) {
    console.error('更新通知偏好异常:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;