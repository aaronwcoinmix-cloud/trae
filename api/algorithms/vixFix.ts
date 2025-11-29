import { Signal, Symbol } from '../../../shared/types';
import { supabase } from '../config/supabase';
import { binanceService } from '../services/binanceService';

interface VixFixParams {
  period: number;
  bollinger_period: number;
  bollinger_std_dev: number;
  threshold_low: number;
  threshold_high: number;
  smoothing_period: number;
}

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface VixFixCalculation {
  vix_fix: number;
  bollinger_middle: number;
  bollinger_upper: number;
  bollinger_lower: number;
  is_oversold: boolean;
  is_overbought: boolean;
}

export class VixFixAlgorithm {
  private params: VixFixParams;
  private name = 'vix_fix';

  constructor(params: VixFixParams) {
    this.params = params;
  }

  // 主分析方法
  async analyze(symbol: Symbol, candleData: CandleData[]): Promise<Signal | null> {
    try {
      // 1. 检查数据完整性
      if (!this.checkDataIntegrity(candleData)) {
        return null;
      }

      // 2. 计算Vix Fix指标
      const vixFixData = this.calculateVixFix(candleData);
      
      // 3. 计算布林带
      const bollingerData = this.calculateBollingerBands(vixFixData.map(d => d.vix_fix));
      
      // 4. 生成交易信号
      const latestData = this.combineData(vixFixData, bollingerData);
      
      // 5. 检查是否生成信号
      const signal = this.generateSignal(symbol, candleData, latestData);
      
      return signal;
    } catch (error) {
      console.error(`VixFix算法分析失败 [${symbol.symbol}]:`, error);
      return null;
    }
  }

  // 检查数据完整性
  private checkDataIntegrity(candleData: CandleData[]): boolean {
    if (!candleData || candleData.length < this.params.period + this.params.bollinger_period) {
      return false;
    }

    // 检查数据质量
    for (const candle of candleData) {
      if (!candle || 
          candle.high <= 0 || 
          candle.low <= 0 || 
          candle.close <= 0 || 
          candle.open <= 0 ||
          candle.high < candle.low) {
        return false;
      }
    }

    return true;
  }

  // 计算Vix Fix指标
  private calculateVixFix(candleData: CandleData[]): VixFixCalculation[] {
    const results: VixFixCalculation[] = [];
    
    for (let i = 0; i < candleData.length; i++) {
      const candle = candleData[i];
      
      // 计算窗口期内最高价
      const windowStart = Math.max(0, i - this.params.period + 1);
      const windowData = candleData.slice(windowStart, i + 1);
      const highestHigh = Math.max(...windowData.map(d => d.high));
      
      // 计算Vix Fix值
      const vixFix = (highestHigh - candle.low) / highestHigh * 100;
      
      results.push({
        vix_fix: vixFix,
        bollinger_middle: 0, // 将在下一步计算
        bollinger_upper: 0,
        bollinger_lower: 0,
        is_oversold: false,
        is_overbought: false
      });
    }
    
    return results;
  }

  // 计算布林带
  private calculateBollingerBands(vixFixValues: number[]): { middle: number[], upper: number[], lower: number[] } {
    const middle: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < vixFixValues.length; i++) {
      const windowStart = Math.max(0, i - this.params.bollinger_period + 1);
      const windowData = vixFixValues.slice(windowStart, i + 1);
      
      // 计算移动平均线（中轨）
      const sma = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
      
      // 计算标准差
      const variance = windowData.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / windowData.length;
      const stdDev = Math.sqrt(variance);
      
      // 计算布林带
      const bbUpper = sma + (this.params.bollinger_std_dev * stdDev);
      const bbLower = sma - (this.params.bollinger_std_dev * stdDev);
      
      middle.push(sma);
      upper.push(bbUpper);
      lower.push(bbLower);
    }
    
    return { middle, upper, lower };
  }

  // 合并Vix Fix和布林带数据
  private combineData(vixFixData: VixFixCalculation[], bollingerData: { middle: number[], upper: number[], lower: number[] }): VixFixCalculation[] {
    const combinedData = [...vixFixData];
    
    for (let i = 0; i < combinedData.length; i++) {
      if (i >= bollingerData.middle.length - 1) {
        const bbIndex = bollingerData.middle.length - 1;
        combinedData[i].bollinger_middle = bollingerData.middle[bbIndex];
        combinedData[i].bollinger_upper = bollingerData.upper[bbIndex];
        combinedData[i].bollinger_lower = bollingerData.lower[bbIndex];
        
        // 判断超买超卖
        combinedData[i].is_oversold = combinedData[i].vix_fix >= this.params.threshold_low;
        combinedData[i].is_overbought = combinedData[i].vix_fix <= this.params.threshold_high;
      }
    }
    
    return combinedData;
  }

  // 生成交易信号
  private generateSignal(symbol: Symbol, candleData: CandleData[], latestData: VixFixCalculation[]): Signal | null {
    if (latestData.length === 0) {
      return null;
    }
    
    const latest = latestData[latestData.length - 1];
    const currentCandle = candleData[candleData.length - 1];
    
    // 检查是否超卖（买入信号）
    if (latest.is_oversold) {
      const strength = this.calculateSignalStrength(latest, true);
      
      if (strength >= 0.5) {
        return this.createSignal(symbol, currentCandle, strength, latest, 'buy');
      }
    }
    
    // 检查是否超买（卖出信号）
    if (latest.is_overbought) {
      const strength = this.calculateSignalStrength(latest, false);
      
      if (strength >= 0.5) {
        return this.createSignal(symbol, currentCandle, strength, latest, 'sell');
      }
    }
    
    return null;
  }

  // 计算信号强度
  private calculateSignalStrength(data: VixFixCalculation, isBuySignal: boolean): number {
    let strength = 0;
    
    if (isBuySignal) {
      // 买入信号强度计算
      const oversoldStrength = (data.vix_fix - this.params.threshold_low) / (1 - this.params.threshold_low);
      strength = Math.min(1, oversoldStrength * 1.5);
      
      // 如果Vix Fix值很高，增加强度
      if (data.vix_fix > 0.8) {
        strength += 0.2;
      }
    } else {
      // 卖出信号强度计算
      const overboughtStrength = (this.params.threshold_high - data.vix_fix) / this.params.threshold_high;
      strength = Math.min(1, overboughtStrength * 1.5);
      
      // 如果Vix Fix值很低，增加强度
      if (data.vix_fix < 0.2) {
        strength += 0.2;
      }
    }
    
    // 考虑布林带位置
    if (data.bollinger_middle > 0) {
      const bbPosition = (data.vix_fix - data.bollinger_lower) / (data.bollinger_upper - data.bollinger_lower);
      
      if (isBuySignal && bbPosition < 0.2) {
        strength += 0.1;
      } else if (!isBuySignal && bbPosition > 0.8) {
        strength += 0.1;
      }
    }
    
    return Math.min(1, strength);
  }

  // 创建信号
  private createSignal(symbol: Symbol, candle: CandleData, strength: number, data: VixFixCalculation, signalType: 'buy' | 'sell'): Signal {
    const now = new Date().toISOString();
    
    return {
      id: `${this.name}_${symbol.symbol}_${Date.now()}`,
      symbol_id: symbol.id,
      algorithm_name: this.name,
      signal_type: signalType,
      strength,
      confidence: Math.min(0.95, strength * 0.9),
      price: candle.close,
      metadata: {
        vix_fix_value: data.vix_fix,
        bollinger_middle: data.bollinger_middle,
        bollinger_upper: data.bollinger_upper,
        bollinger_lower: data.bollinger_lower,
        is_oversold: data.is_oversold,
        is_overbought: data.is_overbought,
        threshold_low: this.params.threshold_low,
        threshold_high: this.params.threshold_high,
        period: this.params.period,
        bollinger_period: this.params.bollinger_period
      },
      status: 'active',
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
    };
  }

  // 获取历史K线数据
  private async getHistoricalData(symbol: string, limit: number = 100): Promise<CandleData[]> {
    try {
      const klines = await binanceService.getKlines(symbol.toUpperCase(), '1h', limit);
      return klines.map(k => ({
        timestamp: k.openTime,
        open: parseFloat(k.open),
        high: parseFloat(k.high),
        low: parseFloat(k.low),
        close: parseFloat(k.close),
        volume: parseFloat(k.volume),
      }));
    } catch (error) {
      console.error(`获取历史数据失败 [${symbol}]:`, error);
      return [];
    }
  }

  // 生成模拟K线数据
  // 移除模拟K线生成，改为真实Binance数据

  // 批量分析多个交易对
  async analyzeBatch(symbols: Symbol[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const symbol of symbols) {
      try {
        // 获取历史数据
        const candleData = await this.getHistoricalData(symbol.symbol, 50);
        
        if (candleData.length > 0) {
          const signal = await this.analyze(symbol, candleData);
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

  // 获取算法名称
  getName(): string {
    return this.name;
  }

  // 获取算法参数
  getParams(): VixFixParams {
    return this.params;
  }

  // 更新算法参数
  updateParams(params: Partial<VixFixParams>): void {
    this.params = { ...this.params, ...params };
  }

  // 平滑Vix Fix值（移动平均）
  private smoothVixFix(vixFixValues: number[]): number[] {
    if (vixFixValues.length < this.params.smoothing_period) {
      return vixFixValues;
    }
    
    const smoothed: number[] = [];
    
    for (let i = 0; i < vixFixValues.length; i++) {
      const windowStart = Math.max(0, i - this.params.smoothing_period + 1);
      const windowData = vixFixValues.slice(windowStart, i + 1);
      const sma = windowData.reduce((sum, val) => sum + val, 0) / windowData.length;
      smoothed.push(sma);
    }
    
    return smoothed;
  }
}
