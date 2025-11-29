import { Signal, Symbol } from '../../../shared/types';
import { supabase } from '../config/supabase';

interface MarketFlowParams {
  volume_threshold: number;
  price_change_threshold: number;
  time_window: number;
  min_volume_ratio: number;
  confirmation_periods: number;
}

interface MarketData {
  symbol: string;
  current_price: number;
  volume_24h: number;
  price_change_24h: number;
  price_change_percent_24h: number;
  high_24h: number;
  low_24h: number;
  open_price_24h: number;
}

export class MarketFlowAlgorithm {
  private params: MarketFlowParams;
  private name = 'market_flow';

  constructor(params: MarketFlowParams) {
    this.params = params;
  }

  // 主分析方法
  async analyze(symbol: Symbol, marketData: MarketData): Promise<Signal | null> {
    try {
      // 1. 检查基本条件
      if (!this.checkBasicConditions(marketData)) {
        return null;
      }

      // 2. 计算市场流量指标
      const marketFlowScore = await this.calculateMarketFlowScore(symbol, marketData);
      
      // 3. 计算信号强度
      const strength = this.calculateSignalStrength(marketFlowScore, marketData);
      
      // 4. 生成信号
      if (strength >= 0.5) { // 最低信号强度阈值
        return this.createSignal(symbol, marketData, strength, marketFlowScore);
      }

      return null;
    } catch (error) {
      console.error(`MarketFlow算法分析失败 [${symbol.symbol}]:`, error);
      return null;
    }
  }

  // 检查基本条件
  private checkBasicConditions(marketData: MarketData): boolean {
    // 检查24小时价格变化是否满足阈值
    if (marketData.price_change_percent_24h > this.params.price_change_threshold) {
      return false;
    }

    // 检查交易量是否足够
    if (marketData.volume_24h <= 0) {
      return false;
    }

    // 检查价格是否在合理范围内
    if (marketData.current_price <= 0) {
      return false;
    }

    return true;
  }

  // 计算市场流量分数
  private async calculateMarketFlowScore(symbol: Symbol, marketData: MarketData): Promise<number> {
    try {
      // 获取历史数据用于比较
      const historicalData = await this.getHistoricalData(symbol.symbol, this.params.time_window);
      
      if (!historicalData || historicalData.length === 0) {
        return 0;
      }

      // 计算平均交易量
      const avgVolume = historicalData.reduce((sum, data) => sum + data.volume_24h, 0) / historicalData.length;
      
      // 计算交易量比率
      const volumeRatio = marketData.volume_24h / avgVolume;
      
      // 计算价格位置（相对于24小时高低范围）
      const pricePosition = (marketData.current_price - marketData.low_24h) / (marketData.high_24h - marketData.low_24h);
      
      // 计算市场流量分数
      let score = 0;
      
      // 交易量因子 (0-40分)
      if (volumeRatio >= this.params.min_volume_ratio) {
        score += Math.min(40, (volumeRatio - this.params.min_volume_ratio) * 20);
      }
      
      // 价格位置因子 (0-30分)
      // 价格接近24小时低点时分数更高
      if (pricePosition <= 0.3) {
        score += (1 - pricePosition / 0.3) * 30;
      }
      
      // 价格变化因子 (0-30分)
      // 价格下跌时分数更高
      if (marketData.price_change_percent_24h < 0) {
        score += Math.min(30, Math.abs(marketData.price_change_percent_24h) * 100);
      }
      
      return Math.min(100, score);
    } catch (error) {
      console.error(`计算市场流量分数失败 [${symbol.symbol}]:`, error);
      return 0;
    }
  }

  // 计算信号强度
  private calculateSignalStrength(marketFlowScore: number, marketData: MarketData): number {
    let strength = marketFlowScore / 100; // 基础强度
    
    // 根据市场条件调整强度
    
    // 如果交易量显著增加，提高强度
    if (marketData.volume_24h > 0) {
      const volumeBoost = Math.min(0.2, marketData.volume_24h / 1000000); // 每百万交易量增加0.1强度，最多0.2
      strength += volumeBoost;
    }
    
    // 如果价格接近24小时低点，提高强度
    const pricePosition = (marketData.current_price - marketData.low_24h) / (marketData.high_24h - marketData.low_24h);
    if (pricePosition <= 0.2) {
      strength += 0.15;
    }
    
    // 确保强度在0-1范围内
    return Math.min(1, Math.max(0, strength));
  }

  // 创建信号
  private createSignal(symbol: Symbol, marketData: MarketData, strength: number, score: number): Signal {
    const now = new Date().toISOString();
    
    return {
      id: `${this.name}_${symbol.symbol}_${Date.now()}`,
      symbol_id: symbol.id,
      algorithm_name: this.name,
      signal_type: 'buy', // Market Flow主要生成买入信号
      strength,
      confidence: Math.min(0.95, strength * 0.9), // 置信度略低于强度
      price: marketData.current_price,
      metadata: {
        market_flow_score: score,
        volume_ratio: marketData.volume_24h,
        price_change_24h: marketData.price_change_percent_24h,
        price_position: (marketData.current_price - marketData.low_24h) / (marketData.high_24h - marketData.low_24h),
        time_window: this.params.time_window,
        volume_threshold: this.params.volume_threshold
      },
      status: 'active',
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
    };
  }

  // 获取历史数据
  private async getHistoricalData(symbol: string, timeWindow: number): Promise<MarketData[]> {
    try {
      const { data, error } = await supabase
        .from('symbols')
        .select(`
          symbol,
          current_price,
          volume_24h,
          price_change_24h,
          price_change_percent_24h,
          high_24h,
          low_24h,
          open_price_24h,
          last_updated
        `)
        .eq('symbol', symbol)
        .gte('last_updated', new Date(Date.now() - timeWindow * 60 * 60 * 1000).toISOString())
        .order('last_updated', { ascending: false })
        .limit(100);

      if (error) {
        console.error(`获取历史数据失败 [${symbol}]:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`获取历史数据异常 [${symbol}]:`, error);
      return [];
    }
  }

  // 批量分析多个交易对
  async analyzeBatch(symbols: Symbol[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const symbol of symbols) {
      try {
        // 获取当前市场数据
        const marketData = await this.getCurrentMarketData(symbol.symbol);
        
        if (marketData) {
          const signal = await this.analyze(symbol, marketData);
          if (signal) {
            signals.push(signal);
          }
        }
        
        // 添加小延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`批量分析失败 [${symbol.symbol}]:`, error);
      }
    }
    
    return signals;
  }

  // 获取当前市场数据
  private async getCurrentMarketData(symbol: string): Promise<MarketData | null> {
    try {
      const { data, error } = await supabase
        .from('symbols')
        .select(`
          symbol,
          current_price,
          volume_24h,
          price_change_24h,
          price_change_percent_24h,
          high_24h,
          low_24h,
          open_price_24h
        `)
        .eq('symbol', symbol)
        .single();

      if (error || !data) {
        console.error(`获取当前市场数据失败 [${symbol}]:`, error);
        return null;
      }

      return data as MarketData;
    } catch (error) {
      console.error(`获取当前市场数据异常 [${symbol}]:`, error);
      return null;
    }
  }

  // 获取算法名称
  getName(): string {
    return this.name;
  }

  // 获取算法参数
  getParams(): MarketFlowParams {
    return this.params;
  }

  // 更新算法参数
  updateParams(params: Partial<MarketFlowParams>): void {
    this.params = { ...this.params, ...params };
  }
}