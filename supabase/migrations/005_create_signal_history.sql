-- 创建信号历史表
CREATE TABLE signal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES signals(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    price FLOAT NOT NULL,
    pnl FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_signal_history_signal_id ON signal_history(signal_id);
CREATE INDEX idx_signal_history_created_at ON signal_history(created_at DESC);

-- 权限设置
GRANT SELECT ON signal_history TO authenticated;