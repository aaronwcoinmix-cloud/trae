-- 创建回测结果表
CREATE TABLE IF NOT EXISTS backtest_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  params JSONB NOT NULL,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  total_return DECIMAL(10,6) NOT NULL DEFAULT 0,
  max_drawdown DECIMAL(10,6) NOT NULL DEFAULT 0,
  sharpe_ratio DECIMAL(10,6) NOT NULL DEFAULT 0,
  profit_factor DECIMAL(10,6) NOT NULL DEFAULT 0,
  avg_win DECIMAL(12,6) NOT NULL DEFAULT 0,
  avg_loss DECIMAL(12,6) NOT NULL DEFAULT 0,
  largest_win DECIMAL(12,6) NOT NULL DEFAULT 0,
  largest_loss DECIMAL(12,6) NOT NULL DEFAULT 0,
  trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  equity_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_returns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_backtest_results_user_id ON backtest_results(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_results_created_at ON backtest_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backtest_results_symbol ON backtest_results((params->>'symbol'));
CREATE INDEX IF NOT EXISTS idx_backtest_results_algorithm ON backtest_results((params->>'algorithm'));

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_backtest_results_updated_at 
  BEFORE UPDATE ON backtest_results 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全
ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;

-- 创建行级安全策略
CREATE POLICY "用户只能查看自己的回测结果" ON backtest_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "用户只能插入自己的回测结果" ON backtest_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的回测结果" ON backtest_results
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的回测结果" ON backtest_results
  FOR DELETE USING (auth.uid() = user_id);

-- 授予权限
GRANT SELECT ON backtest_results TO anon, authenticated;
GRANT INSERT ON backtest_results TO authenticated;
GRANT UPDATE ON backtest_results TO authenticated;
GRANT DELETE ON backtest_results TO authenticated;