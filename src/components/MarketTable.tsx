import React from 'react';
import { MarketData } from '../../../shared/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MarketTableProps {
  data: MarketData[];
}

const MarketTable: React.FC<MarketTableProps> = ({ data }) => {
  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString()}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `${(volume / 1e9).toFixed(2)}B`;
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(2)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getPriceChangeColor = (percent: number) => {
    if (percent > 0) return 'text-green-400';
    if (percent < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">实时价格</h3>
        <p className="text-sm text-gray-400 mt-1">USDT-M合约市场数据</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                交易对
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                价格
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                24h涨跌
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                成交量
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                成交量变化
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((item) => (
              <tr key={item.symbol} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-white">{item.symbol}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-white font-medium">
                    {formatPrice(item.price)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`flex items-center text-sm font-medium ${getPriceChangeColor((item as any).price_change_percent ?? (item as any).price_change_percent_24h ?? 0)}`}>
                    {(((item as any).price_change_percent ?? (item as any).price_change_percent_24h ?? 0) as number) > 0 && <TrendingUp className="h-4 w-4 mr-1" />}
                    {(((item as any).price_change_percent ?? (item as any).price_change_percent_24h ?? 0) as number) < 0 && <TrendingDown className="h-4 w-4 mr-1" />}
                    {formatPercent(((item as any).price_change_percent ?? (item as any).price_change_percent_24h ?? 0) as number)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-300">
                    {formatVolume(item.volume)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${getPriceChangeColor(((item as any).volume_change ?? 0) as number)}`}>
                    {formatPercent(((item as any).volume_change ?? 0) as number)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MarketTable;
