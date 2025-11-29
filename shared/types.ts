// 用户类型
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
  settings?: UserSettings;
  notification_settings?: NotificationSettings;
}

// 订阅类型
export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'basic' | 'premium' | 'professional';
  plan_id?: string;
  start_date: string;
  end_date?: string;
  features: Record<string, any>;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

// 订阅计划类型
export interface SubscriptionPlan {
  id: string;
  plan_type: 'free' | 'basic' | 'premium' | 'professional';
  name: string;
  description?: string;
  price: number;
  currency: string;
  billing_cycle: 'month' | 'year' | 'lifetime';
  max_signals_per_day: number;
  max_backtests_per_month: number;
  max_alerts: number;
  features: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 信号类型
export interface Signal {
  id: string;
  symbol: string;
  symbol_id?: string;
  signal_type: 'buy' | 'sell' | 'neutral';
  strength: number; // 0-1
  confidence: number; // 0-1
  price: number;
  algorithm_name: string;
  algorithm_params?: Record<string, any>;
  metadata?: Record<string, any>;
  status: 'active' | 'expired' | 'invalid';
  expires_at: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

// 交易品种类型
export interface Symbol {
  id: string;
  symbol: string;
  name: string;
  base_asset: string;
  quote_asset: string;
  exchange: string;
  status: 'active' | 'inactive';
  price_precision: number;
  quantity_precision: number;
  min_notional: number;
  max_notional: number;
  created_at: string;
  updated_at: string;
}

// 市场数据类型
export interface MarketData {
  id: string;
  symbol: string;
  symbol_id: string;
  price: number;
  volume_24h: number;
  price_change_24h: number;
  price_change_percent_24h: number;
  high_24h: number;
  low_24h: number;
  open_24h: number;
  close_24h: number;
  timestamp: string;
  created_at: string;
}

// 算法参数类型
export interface AlgorithmParam {
  id: string;
  user_id: string;
  algorithm_name: string;
  parameters: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Market Flow 算法参数
export interface MarketFlowParams {
  volume_threshold: number;
  price_change_threshold: number;
  time_window: number;
  min_volume_ratio: number;
  confirmation_periods: number;
}

// Vix Fix 算法参数
export interface VixFixParams {
  period: number;
  bollinger_period: number;
  bollinger_std_dev: number;
  threshold_low: number;
  threshold_high: number;
  smoothing_period: number;
}

// 用户设置类型
export interface UserSettings {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  date_format: string;
  time_format: string;
  currency: string;
  notifications: NotificationSettings;
}

// 通知设置类型
export interface NotificationSettings {
  email_enabled: boolean;
  browser_enabled: boolean;
  signal_alerts: boolean;
  price_alerts: boolean;
  volume_alerts: boolean;
  alert_frequency: 'immediate' | 'hourly' | 'daily';
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  signal_strength_threshold: number;
}

// 回测参数类型
export interface BacktestParams {
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  position_size: number;
  stop_loss: number;
  take_profit: number;
  algorithm_name: string;
  algorithm_params: Record<string, any>;
}

// 回测结果类型
export interface BacktestResult {
  id: string;
  user_id: string;
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  algorithm_name: string;
  algorithm_params: Record<string, any>;
  initial_capital: number;
  final_capital: number;
  total_return: number;
  total_return_percent: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  win_rate: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  profit_factor: number;
  sharpe_ratio: number;
  trades: Trade[];
  equity_curve: { timestamp: string; equity: number }[];
  monthly_returns: { month: string; return: number }[];
  created_at: string;
}

// 交易记录类型
export interface Trade {
  id: string;
  symbol: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  side: 'long' | 'short';
  pnl: number;
  pnl_percent: number;
  commission: number;
  duration: number; // 秒
  notes?: string;
}

// 通知类型
export interface Notification {
  id: string;
  user_id: string;
  type: 'signal' | 'price' | 'volume' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

// 活动日志类型
export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// WebSocket 消息类型
export interface WebSocketMessage {
  type: 'signal' | 'market_data' | 'notification' | 'system';
  data: any;
  timestamp: string;
}

// 信号筛选器类型
export interface SignalFilter {
  symbol?: string;
  algorithm_name?: string;
  signal_type?: 'buy' | 'sell' | 'neutral';
  min_strength?: number;
  max_strength?: number;
  status?: 'active' | 'expired' | 'invalid';
  start_date?: string;
  end_date?: string;
}

// 市场数据筛选器类型
export interface MarketDataFilter {
  symbol?: string;
  exchange?: string;
  min_price_change?: number;
  max_price_change?: number;
  min_volume?: number;
  max_volume?: number;
}