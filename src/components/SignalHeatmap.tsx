import React from 'react';
import { Signal } from '../../../shared/types';

interface SignalHeatmapProps {
  signals: Signal[];
  onCellClick?: (symbol: string) => void;
}

const SignalHeatmap: React.FC<SignalHeatmapProps> = ({ signals, onCellClick }) => {
  // 获取唯一的交易对列表
  const symbols = Array.from(new Set(signals.map(s => s.symbol))).sort();
  
  // 按交易对分组信号
  const signalsBySymbol = symbols.reduce((acc, symbol) => {
    acc[symbol] = signals.filter(s => s.symbol === symbol);
    return acc;
  }, {} as Record<string, Signal[]>);

  // 获取最新信号
  const getLatestSignal = (symbol: string) => {
    const symbolSignals = signalsBySymbol[symbol] || [];
    return symbolSignals.length > 0 ? symbolSignals[0] : null;
  };

  // 获取信号强度颜色
  const getStrengthColor = (strength: number, signalType: string) => {
    const intensity = Math.floor(strength * 255);
    
    if (signalType === 'buy') {
      return {
        backgroundColor: `rgba(34, 197, 94, ${strength})`,
        borderColor: `rgba(34, 197, 94, ${Math.min(strength + 0.3, 1)})`
      };
    } else if (signalType === 'sell') {
      return {
        backgroundColor: `rgba(239, 68, 68, ${strength})`,
        borderColor: `rgba(239, 68, 68, ${Math.min(strength + 0.3, 1)})`
      };
    } else {
      return {
        backgroundColor: `rgba(107, 114, 128, ${strength * 0.5})`,
        borderColor: `rgba(107, 114, 128, ${Math.min(strength * 0.5 + 0.3, 1)})`
      };
    }
  };

  // 计算网格大小
  const cols = Math.min(5, Math.ceil(Math.sqrt(symbols.length)));
  const rows = Math.ceil(symbols.length / cols);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">信号热力图</h3>
        <p className="text-sm text-gray-400 mt-1">USDT-M合约信号强度分布</p>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {symbols.map((symbol) => {
          const signal = getLatestSignal(symbol);
          const strength = signal ? signal.strength : 0;
          const signalType = signal ? signal.signal_type : 'hold';
          const style = getStrengthColor(strength, signalType);

          return (
            <div
              key={symbol}
              onClick={() => onCellClick?.(symbol)}
              className="aspect-square rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all duration-200"
              style={style}
            >
              <div className="text-white font-semibold text-sm text-center px-1">
                {symbol.replace('USDT', '')}
              </div>
              {signal && (
                <div className="text-white text-xs mt-1">
                  {(strength * 100).toFixed(0)}%
                </div>
              )}
              {!signal && (
                <div className="text-gray-400 text-xs mt-1">
                  无信号
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-300">买入信号</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-300">卖出信号</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-500 rounded"></div>
          <span className="text-gray-300">观望</span>
        </div>
      </div>
    </div>
  );
};

export default SignalHeatmap;