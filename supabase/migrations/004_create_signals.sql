-- 创建信号表
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL REFERENCES symbols(symbol),
    signal_type VARCHAR(20) NOT NULL CHECK (signal_type IN ('buy', 'sell', 'hold')),
    strength FLOAT NOT NULL CHECK (strength >= 0 AND strength <= 1),
    indicators JSONB NOT NULL,
    confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_signals_symbol ON signals(symbol);
CREATE INDEX idx_signals_triggered_at ON signals(triggered_at DESC);
CREATE INDEX idx_signals_strength ON signals(strength DESC);
CREATE INDEX idx_signals_type ON signals(signal_type);

-- 权限设置
GRANT SELECT ON signals TO anon;
GRANT ALL PRIVILEGES ON signals TO authenticated;