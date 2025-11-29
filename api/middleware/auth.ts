import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 验证JWT token的中间件
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: '未提供访问令牌' 
      });
    }

    // 验证JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 检查用户是否仍然存在且活跃
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, status')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        error: '用户不存在' 
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ 
        success: false, 
        error: '用户已被暂停' 
      });
    }

    // 将用户信息添加到请求对象
    (req as any).userId = user.id;
    (req as any).userEmail = user.email;
    
    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false, 
        error: '访问令牌已过期' 
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false, 
        error: '无效的访问令牌' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      error: '访问令牌验证失败' 
    });
  }
};

// 可选认证中间件（不强制要求token）
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, status')
        .eq('id', decoded.userId)
        .single();

      if (!error && user && user.status !== 'suspended') {
        (req as any).userId = user.id;
        (req as any).userEmail = user.email;
      }
    }
    
    next();
  } catch (error) {
    // Token无效时继续，但不设置用户信息
    next();
  }
};

// 生成JWT token的函数
export const generateToken = (userId: string, email: string): string => {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '7d' } // Token有效期7天
  );
};

// 生成刷新token的函数
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' } // 刷新token有效期30天
  );
};

// 验证刷新token
export const verifyRefreshToken = (token: string): string | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return null;
    }
    
    return decoded.userId;
  } catch (error) {
    return null;
  }
};

export default {
  authenticateToken,
  optionalAuthenticate,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};