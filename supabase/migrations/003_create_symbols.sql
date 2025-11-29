-- 创建交易对表
CREATE TABLE symbols (
    symbol VARCHAR(20) PRIMARY KEY,
    base_asset VARCHAR(10) NOT NULL,
    quote_asset VARCHAR(10) NOT NULL,
    price_precision INTEGER NOT NULL,
    quantity_precision INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_symbols_active ON symbols(is_active);

-- 初始数据 - 主要USDT-M合约交易对
INSERT INTO symbols (symbol, base_asset, quote_asset, price_precision, quantity_precision) VALUES
('BTCUSDT', 'BTC', 'USDT', 2, 6),
('ETHUSDT', 'ETH', 'USDT', 2, 5),
('ADAUSDT', 'ADA', 'USDT', 4, 0),
('DOTUSDT', 'DOT', 'USDT', 3, 1),
('LINKUSDT', 'LINK', 'USDT', 3, 1),
('BNBUSDT', 'BNB', 'USDT', 2, 4),
('XRPUSDT', 'XRP', 'USDT', 4, 0),
('LTCUSDT', 'LTC', 'USDT', 2, 3),
('BCHUSDT', 'BCH', 'USDT', 2, 4),
('UNIUSDT', 'UNI', 'USDT', 3, 1),
('AVAXUSDT', 'AVAX', 'USDT', 3, 1),
('MATICUSDT', 'MATIC', 'USDT', 4, 0),
('FTMUSDT', 'FTM', 'USDT', 4, 0),
('ATOMUSDT', 'ATOM', 'USDT', 3, 1),
('ETCUSDT', 'ETC', 'USDT', 3, 1),
('XLMUSDT', 'XLM', 'USDT', 5, 0),
('TRXUSDT', 'TRX', 'USDT', 5, 0),
('VETUSDT', 'VET', 'USDT', 6, 0),
('FILUSDT', 'FIL', 'USDT', 3, 1),
('THETAUSDT', 'THETA', 'USDT', 3, 1);

-- 权限设置
GRANT SELECT ON symbols TO anon;
GRANT ALL PRIVILEGES ON symbols TO authenticated;