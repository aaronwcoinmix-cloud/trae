-- 创建订阅计划表
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_type VARCHAR(20) UNIQUE NOT NULL CHECK (plan_type IN ('free', 'basic', 'premium', 'professional')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) DEFAULT 'month' CHECK (billing_cycle IN ('month', 'year', 'lifetime')),
    max_signals_per_day INTEGER DEFAULT 50,
    max_backtests_per_month INTEGER DEFAULT 10,
    max_alerts INTEGER DEFAULT 20,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建活动日志表
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(200) NOT NULL,
    details TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX idx_subscription_plans_type ON subscription_plans(plan_type);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);

-- 权限设置
GRANT SELECT ON subscription_plans TO anon, authenticated;
GRANT SELECT, INSERT ON activity_log TO authenticated;

-- 插入默认订阅计划
INSERT INTO subscription_plans (plan_type, name, description, price, currency, billing_cycle, max_signals_per_day, max_backtests_per_month, max_alerts, features, is_active) VALUES
('free', '免费版', '基础功能，适合个人用户', 0, 'CNY', 'month', 50, 10, 20, '{"real_time_data": true, "email_notifications": true, "backtesting": false, "advanced_charts": false, "api_access": false, "priority_support": false}', true),
('basic', '基础版', '更多功能，适合进阶用户', 29, 'USD', 'month', 100, 50, 50, '{"real_time_data": true, "email_notifications": true, "backtesting": true, "advanced_charts": true, "api_access": false, "priority_support": false}', true),
('premium', '高级版', '完整功能，适合专业用户', 79, 'USD', 'month', 500, 200, 100, '{"real_time_data": true, "email_notifications": true, "backtesting": true, "advanced_charts": true, "api_access": true, "priority_support": true}', true),
('professional', '专业版', '企业级功能，适合机构用户', 199, 'USD', 'month', 999999, 999999, 999999, '{"real_time_data": true, "email_notifications": true, "backtesting": true, "advanced_charts": true, "api_access": true, "priority_support": true, "white_label": true}', true);