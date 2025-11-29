-- 创建Market Flow算法参数表
CREATE TABLE market_flow_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    volume_threshold FLOAT DEFAULT 1.5,
    price_change_threshold FLOAT DEFAULT 0.02,
    time_window INTEGER DEFAULT 24,
    smoothing_factor FLOAT DEFAULT 0.1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建Vix Fix算法参数表
CREATE TABLE vix_fix_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lookback_period INTEGER DEFAULT 22,
    bollinger_period INTEGER DEFAULT 20,
    bollinger_deviations FLOAT DEFAULT 2.0,
    smoothing_period INTEGER DEFAULT 3,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户设置表
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    alert_enabled BOOLEAN DEFAULT true,
    alert_signal_strength VARCHAR(20) DEFAULT 'medium' CHECK (alert_signal_strength IN ('all', 'strong', 'medium', 'weak')),
    alert_notification_methods JSONB DEFAULT '["browser"]',
    alert_frequency VARCHAR(20) DEFAULT 'realtime' CHECK (alert_frequency IN ('realtime', 'hourly', 'daily')),
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
    language VARCHAR(10) DEFAULT 'zh-CN',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_market_flow_params_user_id ON market_flow_params(user_id);
CREATE INDEX idx_vix_fix_params_user_id ON vix_fix_params(user_id);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- 权限设置
GRANT ALL PRIVILEGES ON market_flow_params TO authenticated;
GRANT ALL PRIVILEGES ON vix_fix_params TO authenticated;
GRANT ALL PRIVILEGES ON user_settings TO authenticated;