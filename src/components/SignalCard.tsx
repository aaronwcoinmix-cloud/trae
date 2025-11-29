import React from 'react';
import { Signal } from '../../../shared/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SignalCardProps {
  signal: Signal;
  onClick?: () => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ signal, onClick }) => {
  const getSignalColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-400 bg-green-900/20 border-green-700';
      case 'sell':
        return 'text-red-400 bg-red-900/20 border-red-700';
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700';
    }
  };

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'buy':
        return <TrendingUp className="h-4 w-4" />;
      case 'sell':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getStrengthColor = (strength: number) => {
    if (strength >= 0.8) return 'text-red-400';
    if (strength >= 0.6) return 'text-yellow-400';
    if (strength >= 0.4) return 'text-blue-400';
    return 'text-gray-400';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer hover:shadow-lg"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${getSignalColor(signal.signal_type)}`}>
            {getSignalIcon(signal.signal_type)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{signal.symbol}</h3>
            <p className="text-sm text-gray-400">{formatTime(signal.triggered_at)}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-lg font-bold ${getStrengthColor(signal.strength)}`}>
            {(signal.strength * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-gray-500">信号强度</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-gray-700 rounded p-2">
          <p className="text-xs text-gray-400">Market Flow</p>
          <p className="text-sm font-medium text-white">
            {signal.indicators.market_flow?.toFixed(3) || '0.000'}
          </p>
        </div>
        <div className="bg-gray-700 rounded p-2">
          <p className="text-xs text-gray-400">Vix Fix</p>
          <p className="text-sm font-medium text-white">
            {signal.indicators.vix_fix?.toFixed(3) || '0.000'}
          </p>
        </div>
        <div className="bg-gray-700 rounded p-2">
          <p className="text-xs text-gray-400">置信度</p>
          <p className="text-sm font-medium text-white">
            {(signal.confidence_score * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          signal.signal_type === 'buy' ? 'bg-green-900/50 text-green-300' :
          signal.signal_type === 'sell' ? 'bg-red-900/50 text-red-300' :
          'bg-gray-900/50 text-gray-300'
        }`}>
          {signal.signal_type === 'buy' ? '买入信号' :
           signal.signal_type === 'sell' ? '卖出信号' : '观望'}
        </span>
        
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-400">活跃</span>
        </div>
      </div>
    </div>
  );
};

export default SignalCard;