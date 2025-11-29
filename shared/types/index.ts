export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'premium' | 'admin';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'basic' | 'premium' | 'enterprise';
  start_date: string;
  end_date?: string;
  features: Record<string, any>;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
}

export interface Symbol {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  price_precision: number;
  quantity_precision: number;
  is_active: boolean;
  created_at: string;
}

export interface Signal {
  id: string;
  symbol: string;
  signal_type: 'buy' | 'sell' | 'hold';
  strength: number; // 0-1
  indicators: {
    market_flow: number;
    vix_fix: number;
    [key: string]: any;
  };
  confidence_score: number; // 0-1
  triggered_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SignalHistory {
  id: string;
  signal_id: string;
  action: string;
  price: number;
  pnl?: number;
  created_at: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  price_change: number;
  price_change_percent: number;
  volume: number;
  volume_change: number;
  timestamp: string;
}

export interface MarketFlowParams {
  volume_threshold: number;
  price_change_threshold: number;
  time_window: number;
  smoothing_factor: number;
}

export interface VixFixParams {
  lookback_period: number;
  bollinger_period: number;
  bollinger_deviations: number;
  smoothing_period: number;
}

export interface AlertSettings {
  enabled: boolean;
  signal_strength: 'all' | 'strong' | 'medium' | 'weak';
  notification_methods: string[];
  frequency: 'realtime' | 'hourly' | 'daily';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}