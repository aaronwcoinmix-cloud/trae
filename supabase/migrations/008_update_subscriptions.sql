-- 更新订阅表结构，添加对subscription_plans的外键引用
ALTER TABLE subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

-- 添加plan_id列来引用subscription_plans
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);

-- 更新现有数据，将plan_type转换为plan_id
UPDATE subscriptions 
SET plan_id = (
  SELECT id FROM subscription_plans 
  WHERE subscription_plans.plan_type = subscriptions.plan_type
  LIMIT 1
)
WHERE plan_id IS NULL;

-- 修改plan_type列，移除约束
ALTER TABLE subscriptions 
ALTER COLUMN plan_type DROP NOT NULL;

-- 添加新的约束
ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_plan_id_not_null 
CHECK (plan_id IS NOT NULL OR plan_type IS NOT NULL);

-- 更新权限
GRANT SELECT ON subscriptions TO authenticated;