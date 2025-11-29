import { Signal, Symbol, User, AlgorithmParam } from '../../../shared/types';
import { supabase } from '../config/supabase';
import { MarketFlowAlgorithm } from './marketFlow';
import { VixFixAlgorithm } from './vixFix';
import { io } from '../server';

export interface SignalEngineConfig {
  batchSize: number;
  analysisInterval: number; // 毫秒
  maxConcurrentAnalyses: number;
  signalExpirationHours: number;
}

export class SignalEngine {
  private marketFlowAlgorithm: MarketFlowAlgorithm;
  private vixFixAlgorithm: VixFixAlgorithm;
  private isRunning = false;
  private analysisTimer: NodeJS.Timeout | null = null;
  private config: SignalEngineConfig;

  constructor(config: SignalEngineConfig = {
    batchSize: 10,
    analysisInterval: 5 * 60 * 1000, // 5分钟
    maxConcurrentAnalyses: 5,
    signalExpirationHours: 24
  }) {
    this.config = config;
    
    // 初始化算法，使用默认参数
    this.marketFlowAlgorithm = new MarketFlowAlgorithm({
      volume_threshold: 1.5,
      price_change_threshold: -0.02,
      time_window: 24,
      min_volume_ratio: 2.0,
      confirmation_periods: 3
    });

    this.vixFixAlgorithm = new VixFixAlgorithm({
      period: 22,
      bollinger_period: 20,
      bollinger_std_dev: 2.0,
      threshold_low: 0.7,
      threshold_high: 0.3,
      smoothing_period: 3
    });
  }

  // 启动信号引擎
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('信号引擎已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('信号引擎已启动');

    // 立即执行一次分析
    await this.performAnalysis();

    // 设置定时分析
    this.analysisTimer = setInterval(async () => {
      await this.performAnalysis();
    }, this.config.analysisInterval);
  }

  // 停止信号引擎
  stop(): void {
    this.isRunning = false;
    
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    console.log('信号引擎已停止');
  }

  // 执行分析
  private async performAnalysis(): Promise<void> {
    try {
      console.log('开始执行信号分析...');
      
      // 获取活跃的交易对
      const symbols = await this.getActiveSymbols();
      console.log(`获取到 ${symbols.length} 个活跃交易对`);

      if (symbols.length === 0) {
        console.log('没有活跃的交易对需要分析');
        return;
      }

      // 分批处理交易对
      const batches = this.createBatches(symbols, this.config.batchSize);
      
      for (const batch of batches) {
        await this.analyzeBatch(batch);
        
        // 批次间延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('信号分析完成');
    } catch (error) {
      console.error('信号分析失败:', error);
    }
  }

  // 获取活跃的交易对
  private async getActiveSymbols(): Promise<Symbol[]> {
    try {
      const { data, error } = await supabase
        .from('symbols')
        .select('*')
        .eq('is_active', true)
        .order('volume_24h', { ascending: false })
        .limit(100);

      if (error) {
        console.error('获取活跃交易对失败:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('获取活跃交易对异常:', error);
      return [];
    }
  }

  // 创建批次
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  // 分析批次
  private async analyzeBatch(symbols: Symbol[]): Promise<void> {
    try {
      // 并行运行两种算法
      const [marketFlowSignals, vixFixSignals] = await Promise.all([
        this.runMarketFlowAnalysis(symbols),
        this.runVixFixAnalysis(symbols)
      ]);

      // 合并信号
      const allSignals = [...marketFlowSignals, ...vixFixSignals];
      
      if (allSignals.length > 0) {
        // 保存信号到数据库
        await this.saveSignals(allSignals);
        
        // 发送实时更新
        this.broadcastSignals(allSignals);
        
        console.log(`批次分析完成: ${allSignals.length} 个新信号`);
      }
    } catch (error) {
      console.error('批次分析失败:', error);
    }
  }

  // 运行Market Flow分析
  private async runMarketFlowAnalysis(symbols: Symbol[]): Promise<Signal[]> {
    try {
      // 获取用户自定义参数
      const userParams = await this.getUserAlgorithmParams('market_flow');
      
      if (userParams.length > 0) {
        // 使用用户参数
        const signals: Signal[] = [];
        
        for (const param of userParams) {
          if (param.is_active) {
            this.marketFlowAlgorithm.updateParams(param.parameters);
            const batchSignals = await this.marketFlowAlgorithm.analyzeBatch(symbols);
            signals.push(...batchSignals);
          }
        }
        
        return signals;
      } else {
        // 使用默认参数
        return await this.marketFlowAlgorithm.analyzeBatch(symbols);
      }
    } catch (error) {
      console.error('Market Flow分析失败:', error);
      return [];
    }
  }

  // 运行Vix Fix分析
  private async runVixFixAnalysis(symbols: Symbol[]): Promise<Signal[]> {
    try {
      // 获取用户自定义参数
      const userParams = await this.getUserAlgorithmParams('vix_fix');
      
      if (userParams.length > 0) {
        // 使用用户参数
        const signals: Signal[] = [];
        
        for (const param of userParams) {
          if (param.is_active) {
            this.vixFixAlgorithm.updateParams(param.parameters);
            const batchSignals = await this.vixFixAlgorithm.analyzeBatch(symbols);
            signals.push(...batchSignals);
          }
        }
        
        return signals;
      } else {
        // 使用默认参数
        return await this.vixFixAlgorithm.analyzeBatch(symbols);
      }
    } catch (error) {
      console.error('Vix Fix分析失败:', error);
      return [];
    }
  }

  // 获取用户算法参数
  private async getUserAlgorithmParams(algorithmName: string): Promise<AlgorithmParam[]> {
    try {
      const { data, error } = await supabase
        .from('algorithm_params')
        .select('*')
        .eq('algorithm_name', algorithmName)
        .eq('is_active', true);

      if (error) {
        console.error(`获取${algorithmName}用户参数失败:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`获取${algorithmName}用户参数异常:`, error);
      return [];
    }
  }

  // 保存信号到数据库
  private async saveSignals(signals: Signal[]): Promise<void> {
    try {
      if (signals.length === 0) return;

      // 检查是否已存在相同信号
      const newSignals = await this.filterExistingSignals(signals);
      
      if (newSignals.length === 0) {
        console.log('没有新的信号需要保存');
        return;
      }

      // 保存信号
      const { error: signalsError } = await supabase
        .from('signals')
        .insert(newSignals);

      if (signalsError) {
        console.error('保存信号失败:', signalsError);
        return;
      }

      // 为每个用户创建通知
      await this.createNotificationsForUsers(newSignals);

      console.log(`成功保存 ${newSignals.length} 个新信号`);
    } catch (error) {
      console.error('保存信号异常:', error);
    }
  }

  // 过滤已存在的信号
  private async filterExistingSignals(signals: Signal[]): Promise<Signal[]> {
    try {
      // 获取最近24小时的信号
      const { data: existingSignals } = await supabase
        .from('signals')
        .select('symbol_id, algorithm_name, signal_type, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!existingSignals || existingSignals.length === 0) {
        return signals;
      }

      // 过滤掉重复信号
      return signals.filter(signal => {
        const isDuplicate = existingSignals.some(existing => 
          existing.symbol_id === signal.symbol_id &&
          existing.algorithm_name === signal.algorithm_name &&
          existing.signal_type === signal.signal_type
        );
        
        return !isDuplicate;
      });
    } catch (error) {
      console.error('过滤重复信号失败:', error);
      return signals;
    }
  }

  // 广播信号更新
  private broadcastSignals(signals: Signal[]): void {
    try {
      if (signals.length === 0) return;

      // 向所有连接的客户端发送信号更新
      io.to('signals_room').emit('signals_update', {
        type: 'new_signals',
        data: signals,
        timestamp: new Date().toISOString()
      });

      console.log(`广播 ${signals.length} 个新信号`);
    } catch (error) {
      console.error('广播信号失败:', error);
    }
  }

  // 手动触发分析（用于测试或手动更新）
  async triggerAnalysis(symbols?: Symbol[]): Promise<Signal[]> {
    try {
      const targetSymbols = symbols || await this.getActiveSymbols();
      
      if (targetSymbols.length === 0) {
        console.log('没有交易对需要分析');
        return [];
      }

      const signals = [];
      
      // 分批处理
      const batches = this.createBatches(targetSymbols, this.config.batchSize);
      
      for (const batch of batches) {
        const batchSignals = await this.analyzeBatch(batch);
        signals.push(...batchSignals);
      }

      console.log(`手动分析完成: ${signals.length} 个新信号`);
      return signals;
    } catch (error) {
      console.error('手动分析失败:', error);
      return [];
    }
  }

  // 清理过期信号
  async cleanupExpiredSignals(): Promise<void> {
    try {
      const expirationTime = new Date(Date.now() - this.config.signalExpirationHours * 60 * 60 * 1000);
      
      const { error } = await supabase
        .from('signals')
        .update({ status: 'expired' })
        .lt('created_at', expirationTime.toISOString())
        .eq('status', 'active');

      if (error) {
        console.error('清理过期信号失败:', error);
        return;
      }

      console.log('过期信号清理完成');
    } catch (error) {
      console.error('清理过期信号异常:', error);
    }
  }

  // 为用户创建通知
  private async createNotificationsForUsers(signals: Signal[]): Promise<void> {
    try {
      // 获取所有活跃用户的通知偏好
      const { data: preferences, error: prefError } = await supabase
        .from('notification_preferences')
        .select('user_id, signal_notifications, signal_types, min_signal_strength, quiet_hours')
        .eq('signal_notifications', true);

      if (prefError) {
        console.error('获取用户通知偏好失败:', prefError);
        return;
      }

      if (!preferences || preferences.length === 0) {
        return;
      }

      // 获取当前时间，检查是否处于安静时段
      const now = new Date();
      const currentHour = now.getHours();

      // 为每个符合条件的用户创建通知
      const notifications = [];
      
      for (const signal of signals) {
        for (const pref of preferences) {
          // 检查信号类型是否符合用户偏好
          if (!pref.signal_types.includes(signal.signal_type)) {
            continue;
          }

          // 检查信号强度是否符合最低要求
          if (signal.strength < pref.min_signal_strength) {
            continue;
          }

          // 检查是否处于安静时段
          if (pref.quiet_hours?.enabled) {
            const startHour = parseInt(pref.quiet_hours.start.split(':')[0]);
            const endHour = parseInt(pref.quiet_hours.end.split(':')[0]);
            
            if (startHour <= endHour) {
              if (currentHour >= startHour && currentHour < endHour) {
                continue; // 处于安静时段，跳过
              }
            } else {
              if (currentHour >= startHour || currentHour < endHour) {
                continue; // 处于安静时段，跳过
              }
            }
          }

          // 创建通知
          notifications.push({
            user_id: pref.user_id,
            type: 'signal',
            title: `新${signal.signal_type === 'buy' ? '买入' : '卖出'}信号`,
            message: `${signal.symbol_name} - ${signal.algorithm_name}算法检测到${signal.signal_type === 'buy' ? '买入' : '卖出'}信号`,
            data: {
              signal_id: signal.id,
              symbol: signal.symbol_name,
              algorithm: signal.algorithm_name,
              signal_type: signal.signal_type,
              strength: signal.strength,
              confidence: signal.confidence,
              price: signal.current_price
            },
            is_read: false,
            created_at: now.toISOString()
          });
        }
      }

      if (notifications.length === 0) {
        return;
      }

      // 批量插入通知
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('批量创建通知失败:', notifError);
        return;
      }

      console.log(`成功创建 ${notifications.length} 条用户通知`);
    } catch (error) {
      console.error('创建用户通知异常:', error);
    }
  }

  // 获取引擎状态
  getStatus(): { isRunning: boolean; config: SignalEngineConfig } {
    return {
      isRunning: this.isRunning,
      config: this.config
    };
  }

  // 更新引擎配置
  updateConfig(newConfig: Partial<SignalEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 如果引擎正在运行，重启以应用新配置
    if (this.isRunning) {
      this.stop();
      setTimeout(() => this.start(), 1000);
    }
  }

  // 更新算法参数
  async updateAlgorithmParams(algorithmName: 'market_flow' | 'vix_fix', params: any): Promise<void> {
    try {
      if (algorithmName === 'market_flow') {
        this.marketFlowAlgorithm.updateParams(params);
      } else if (algorithmName === 'vix_fix') {
        this.vixFixAlgorithm.updateParams(params);
      }
      
      console.log(`已更新 ${algorithmName} 算法参数`);
    } catch (error) {
      console.error(`更新算法参数失败:`, error);
    }
  }
}