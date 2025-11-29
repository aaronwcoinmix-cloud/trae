import { VixFixAlgorithm } from './vixFix';
import { BinanceService } from '../services/binanceService';

interface BacktestParams {
  algorithm: 'marketFlow' | 'vixFix' | 'combined';
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  marketFlowParams?: {
    volumeThreshold: number;
    pricePositionThreshold: number;
    confirmationPeriods: number;
  };
  vixFixParams?: {
    period: number;
    bollingerPeriod: number;
    stdDevMultiplier: number;
    threshold: number;
  };
  userId: string;
}

interface BacktestResult {
  id?: string;
  params: BacktestParams;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  trades: Trade[];
  equityCurve: { date: string; value: number }[];
  monthlyReturns: { month: string; return: number }[];
  createdAt?: string;
}

interface Trade {
  id: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  side: 'long' | 'short';
  signalStrength: number;
  algorithm: string;
  exitReason: 'takeProfit' | 'stopLoss' | 'signal' | 'endOfPeriod';
}

interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export class BacktestEngine {
  private vixFix: VixFixAlgorithm;
  private binanceService: BinanceService;

  constructor() {
    this.vixFix = new VixFixAlgorithm({
      period: 22,
      bollinger_period: 20,
      bollinger_std_dev: 2.0,
      threshold_low: 0.7,
      threshold_high: 0.3,
      smoothing_period: 3,
    } as any);
    this.binanceService = new BinanceService();
  }

  async runBacktest(params: BacktestParams, overrideCandles?: Array<{ openTime: number; open: number; high: number; low: number; close: number; volume: number }>): Promise<BacktestResult> {
    try {
      // 获取历史数据
      const historicalData = overrideCandles && overrideCandles.length > 0
        ? overrideCandles
        : await this.binanceService.getHistoricalKlines(
            params.symbol,
            params.timeframe,
            params.startDate,
            params.endDate
          );

      if (historicalData.length < 50) {
        throw new Error('历史数据不足，无法进行回测');
      }

      // 初始化变量
      let capital = params.initialCapital;
      let position = 0;
      let trades: Trade[] = [];
      const equityCurve: { date: string; value: number }[] = [];
      const monthlyReturns: { month: string; return: number }[] = [];
      
      let monthlyStartCapital = capital;
      let currentMonth = new Date(historicalData[0].openTime).getMonth();
      let currentYear = new Date(historicalData[0].openTime).getFullYear();

      // 回测主循环
      for (let i = 50; i < historicalData.length; i++) {
        const currentData = historicalData.slice(Math.max(0, i - 100), i + 1);
        const currentCandle = historicalData[i];
        const currentDate = new Date(currentCandle.openTime);

        // 计算月度收益
        if (currentDate.getMonth() !== currentMonth || currentDate.getFullYear() !== currentYear) {
          const monthlyReturn = (capital - monthlyStartCapital) / monthlyStartCapital;
          monthlyReturns.push({
            month: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
            return: monthlyReturn
          });
          monthlyStartCapital = capital;
          currentMonth = currentDate.getMonth();
          currentYear = currentDate.getFullYear();
        }

        // 更新权益曲线
        equityCurve.push({
          date: currentDate.toISOString().split('T')[0],
          value: capital + (position * currentCandle.close)
        });

        // 检查是否有持仓
        if (position !== 0) {
          // 检查止损
          const entryTrade = trades.find(t => !t.exitDate);
          if (entryTrade) {
            const priceChange = (currentCandle.close - entryTrade.entryPrice) / entryTrade.entryPrice;
            
            if (priceChange <= -params.stopLoss) {
              // 触发止损
              const exitPrice = currentCandle.close;
              const pnl = (exitPrice - entryTrade.entryPrice) * entryTrade.quantity;
              const pnlPercent = (exitPrice - entryTrade.entryPrice) / entryTrade.entryPrice;
              
              entryTrade.exitDate = currentDate.toISOString();
              entryTrade.exitPrice = exitPrice;
              entryTrade.pnl = pnl;
              entryTrade.pnlPercent = pnlPercent;
              entryTrade.exitReason = 'stopLoss';
              
              capital += pnl;
              position = 0;
              continue;
            }
            
            if (priceChange >= params.takeProfit) {
              // 触发止盈
              const exitPrice = currentCandle.close;
              const pnl = (exitPrice - entryTrade.entryPrice) * entryTrade.quantity;
              const pnlPercent = (exitPrice - entryTrade.entryPrice) / entryTrade.entryPrice;
              
              entryTrade.exitDate = currentDate.toISOString();
              entryTrade.exitPrice = exitPrice;
              entryTrade.pnl = pnl;
              entryTrade.pnlPercent = pnlPercent;
              entryTrade.exitReason = 'takeProfit';
              
              capital += pnl;
              position = 0;
              continue;
            }
          }
        }

        // 生成交易信号
        const signal = await this.generateSignal(params.algorithm, currentData, params);
        
        if (signal && position === 0) {
          // 开仓
          const quantity = (capital * params.positionSize) / currentCandle.close;
          const trade: Trade = {
            id: `trade_${trades.length + 1}`,
            entryDate: currentDate.toISOString(),
            exitDate: '',
            entryPrice: currentCandle.close,
            exitPrice: 0,
            quantity,
            pnl: 0,
            pnlPercent: 0,
            side: 'long',
            signalStrength: signal.strength,
            algorithm: params.algorithm,
            exitReason: 'signal'
          };
          
          trades.push(trade);
          position = quantity;
        } else if (!signal && position !== 0) {
          // 平仓（信号消失）
          const entryTrade = trades.find(t => !t.exitDate);
          if (entryTrade) {
            const exitPrice = currentCandle.close;
            const pnl = (exitPrice - entryTrade.entryPrice) * entryTrade.quantity;
            const pnlPercent = (exitPrice - entryTrade.entryPrice) / entryTrade.entryPrice;
            
            entryTrade.exitDate = currentDate.toISOString();
            entryTrade.exitPrice = exitPrice;
            entryTrade.pnl = pnl;
            entryTrade.pnlPercent = pnlPercent;
            entryTrade.exitReason = 'signal';
            
            capital += pnl;
            position = 0;
          }
        }
      }

      // 处理最后一个月的数据
      const lastMonthlyReturn = (capital - monthlyStartCapital) / monthlyStartCapital;
      monthlyReturns.push({
        month: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
        return: lastMonthlyReturn
      });

      // 计算统计指标
      const completedTrades = trades.filter(t => t.exitDate);
      const winningTrades = completedTrades.filter(t => t.pnl > 0);
      const losingTrades = completedTrades.filter(t => t.pnl <= 0);
      
      const totalReturn = (capital - params.initialCapital) / params.initialCapital;
      const winRate = completedTrades.length > 0 ? winningTrades.length / completedTrades.length : 0;
      const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
      const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;
      const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
      
      const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
      const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;
      
      // 计算最大回撤
      const maxDrawdown = this.calculateMaxDrawdown(equityCurve);
      
      // 计算夏普比率
      const sharpeRatio = this.calculateSharpeRatio(monthlyReturns);

      return {
        params,
        totalTrades: completedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate,
        totalReturn,
        maxDrawdown,
        sharpeRatio,
        profitFactor,
        avgWin,
        avgLoss,
        largestWin,
        largestLoss,
        trades: completedTrades,
        equityCurve,
        monthlyReturns
      };
    } catch (error) {
      console.error('回测执行失败:', error);
      throw error;
    }
  }

  async runBatchBacktest(params: {
    symbol: string;
    timeframe: string;
    startDate: Date;
    endDate: Date;
    initialCapital: number;
    parameterRanges: {
      algorithm: ('marketFlow' | 'vixFix' | 'combined')[];
      positionSize?: ParameterRange[];
      stopLoss?: ParameterRange[];
      takeProfit?: ParameterRange[];
      marketFlowParams?: {
        volumeThreshold?: ParameterRange[];
        pricePositionThreshold?: ParameterRange[];
        confirmationPeriods?: ParameterRange[];
      };
      vixFixParams?: {
        period?: ParameterRange[];
        bollingerPeriod?: ParameterRange[];
        stdDevMultiplier?: ParameterRange[];
        threshold?: ParameterRange[];
      };
    };
    userId: string;
  }): Promise<BacktestResult[]> {
    const results: BacktestResult[] = [];
    const { algorithm, positionSize, stopLoss, takeProfit, marketFlowParams, vixFixParams } = params.parameterRanges;

    // 生成参数组合
    const parameterCombinations = this.generateParameterCombinations({
      algorithm,
      positionSize: positionSize || [],
      stopLoss: stopLoss || [],
      takeProfit: takeProfit || [],
      marketFlowParams: marketFlowParams || {},
      vixFixParams: vixFixParams || {}
    });

    console.log(`开始批量回测，共 ${parameterCombinations.length} 种参数组合`);

    for (let i = 0; i < parameterCombinations.length; i++) {
      const combination = parameterCombinations[i];
      
      try {
        const result = await this.runBacktest({
          algorithm: combination.algorithm,
          symbol: params.symbol,
          timeframe: params.timeframe,
          startDate: params.startDate,
          endDate: params.endDate,
          initialCapital: params.initialCapital,
          positionSize: combination.positionSize,
          stopLoss: combination.stopLoss,
          takeProfit: combination.takeProfit,
          marketFlowParams: combination.marketFlowParams,
          vixFixParams: combination.vixFixParams,
          userId: params.userId
        });
        
        results.push(result);
        
        // 每5个组合后暂停一下，避免API限制
        if ((i + 1) % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`参数组合 ${i + 1} 回测失败:`, error);
        // 继续执行下一个组合
      }
    }

    return results;
  }

  private async generateSignal(
    algorithm: 'marketFlow' | 'vixFix' | 'combined',
    data: any[],
    params: BacktestParams
  ): Promise<{ strength: number } | null> {
    try {
      const symbol = { symbol: params.symbol } as any;

      if (algorithm === 'marketFlow') {
        const mf = this.analyzeMarketFlowFromCandles(data);
        return mf;
      } else if (algorithm === 'vixFix') {
        const signal = await this.vixFix.analyze(symbol, data);
        return signal ? { strength: signal.strength } : null;
      } else if (algorithm === 'combined') {
        const mf = this.analyzeMarketFlowFromCandles(data);
        const vf = await this.vixFix.analyze(symbol, data);
        if (mf && vf) {
          return { strength: (mf.strength + vf.strength) / 2 };
        }
        return null;
      }
      
      return null;
    } catch (error) {
      console.error('生成信号失败:', error);
      return null;
    }
  }

  // 基于K线数据的简化 Market Flow 信号，用于回测
  private analyzeMarketFlowFromCandles(candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>): { strength: number } | null {
    if (!candles || candles.length < 30) return null;

    const last = candles[candles.length - 1];
    const window = candles.slice(-24);
    const avgVol = window.reduce((s, c) => s + c.volume, 0) / window.length;
    const volRatio = avgVol > 0 ? last.volume / avgVol : 0;

    const high24 = Math.max(...window.map(c => c.high));
    const low24 = Math.min(...window.map(c => c.low));
    const range = high24 - low24;
    const pricePos = range > 0 ? (last.close - low24) / range : 0.5;

    const priceChangePct = window.length >= 2 ? (last.close - window[0].close) / window[0].close : 0;

    // 评分：量能、价格位置、跌幅
    let score = 0;
    if (volRatio >= 2.0) score += Math.min(40, (volRatio - 2.0) * 20);
    if (pricePos <= 0.3) score += (1 - pricePos / 0.3) * 30;
    if (priceChangePct < 0) score += Math.min(30, Math.abs(priceChangePct) * 100);

    const strength = Math.min(1, Math.max(0, score / 100));
    if (strength >= 0.5) return { strength };
    return null;
  }

  private calculateMaxDrawdown(equityCurve: { date: string; value: number }[]): number {
    if (equityCurve.length === 0) return 0;

    let maxDrawdown = 0;
    let peak = equityCurve[0].value;

    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      } else {
        const drawdown = (peak - point.value) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown;
  }

  private calculateSharpeRatio(monthlyReturns: { month: string; return: number }[]): number {
    if (monthlyReturns.length < 2) return 0;

    const returns = monthlyReturns.map(m => m.return);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    // 年化收益率和无风险利率（假设3%）
    const annualizedReturn = avgReturn * 12;
    const riskFreeRate = 0.03;
    const annualizedStdDev = stdDev * Math.sqrt(12);

    return annualizedStdDev !== 0 ? (annualizedReturn - riskFreeRate) / annualizedStdDev : 0;
  }

  private generateParameterCombinations(ranges: any): any[] {
    const combinations: any[] = [];
    
    for (const algorithm of ranges.algorithm) {
      const baseCombination = { algorithm };
      
      // 基础参数组合
      if (ranges.positionSize.length === 0) ranges.positionSize = [{ min: 0.1, max: 0.1, step: 0.1 }];
      if (ranges.stopLoss.length === 0) ranges.stopLoss = [{ min: 0.02, max: 0.02, step: 0.02 }];
      if (ranges.takeProfit.length === 0) ranges.takeProfit = [{ min: 0.05, max: 0.05, step: 0.05 }];

      for (const posSize of this.generateRangeValues(ranges.positionSize[0])) {
        for (const stopLoss of this.generateRangeValues(ranges.stopLoss[0])) {
          for (const takeProfit of this.generateRangeValues(ranges.takeProfit[0])) {
            const combination = {
              ...baseCombination,
              positionSize: posSize,
              stopLoss: stopLoss,
              takeProfit: takeProfit,
              marketFlowParams: {},
              vixFixParams: {}
            };

            // Market Flow 参数
            if (algorithm === 'marketFlow' || algorithm === 'combined') {
              const mfRanges = ranges.marketFlowParams;
              if (mfRanges && mfRanges.volumeThreshold) {
                for (const volThresh of this.generateRangeValues(mfRanges.volumeThreshold[0])) {
                  for (const priceThresh of this.generateRangeValues(mfRanges.pricePositionThreshold?.[0] || { min: 0.3, max: 0.3, step: 0.3 })) {
                    for (const confPeriods of this.generateRangeValues(mfRanges.confirmationPeriods?.[0] || { min: 3, max: 3, step: 3 })) {
                      combinations.push({
                        ...combination,
                        marketFlowParams: {
                          volumeThreshold: volThresh,
                          pricePositionThreshold: priceThresh,
                          confirmationPeriods: confPeriods
                        }
                      });
                    }
                  }
                }
              } else {
                combinations.push({
                  ...combination,
                  marketFlowParams: {
                    volumeThreshold: 1.5,
                    pricePositionThreshold: 0.3,
                    confirmationPeriods: 3
                  }
                });
              }
            }

            // Vix Fix 参数
            if (algorithm === 'vixFix' || algorithm === 'combined') {
              const vfRanges = ranges.vixFixParams;
              if (vfRanges && vfRanges.period) {
                for (const period of this.generateRangeValues(vfRanges.period[0])) {
                  for (const bollPeriod of this.generateRangeValues(vfRanges.bollingerPeriod?.[0] || { min: 20, max: 20, step: 20 })) {
                    for (const stdDev of this.generateRangeValues(vfRanges.stdDevMultiplier?.[0] || { min: 2.0, max: 2.0, step: 2.0 })) {
                      for (const threshold of this.generateRangeValues(vfRanges.threshold?.[0] || { min: 0.7, max: 0.7, step: 0.7 })) {
                        combinations.push({
                          ...combination,
                          vixFixParams: {
                            period,
                            bollingerPeriod: bollPeriod,
                            stdDevMultiplier: stdDev,
                            threshold
                          }
                        });
                      }
                    }
                  }
                }
              } else {
                combinations.push({
                  ...combination,
                  vixFixParams: {
                    period: 22,
                    bollingerPeriod: 20,
                    stdDevMultiplier: 2.0,
                    threshold: 0.7
                  }
                });
              }
            }

            // 基础算法（无特殊参数）
            if (algorithm === 'marketFlow' && !ranges.marketFlowParams) {
              combinations.push(combination);
            } else if (algorithm === 'vixFix' && !ranges.vixFixParams) {
              combinations.push(combination);
            }
          }
        }
      }
    }

    return combinations;
  }

  private generateRangeValues(range: { min: number; max: number; step: number }): number[] {
    const values: number[] = [];
    for (let val = range.min; val <= range.max; val += range.step) {
      values.push(Number(val.toFixed(4)));
    }
    return values;
  }
}
