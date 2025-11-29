import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { supabase } from '../utils/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, Settings, Play, Download, Filter } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface BacktestParams {
  algorithm: 'marketFlow' | 'vixFix' | 'combined';
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
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
}

interface BacktestResult {
  id: string;
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
  createdAt: string;
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
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT',
  'XRPUSDT', 'DOTUSDT', 'AVAXUSDT', 'MATICUSDT', 'ATOMUSDT'
];

const TIMEFRAMES = [
  { value: '1m', label: '1分钟' },
  { value: '5m', label: '5分钟' },
  { value: '15m', label: '15分钟' },
  { value: '1h', label: '1小时' },
  { value: '4h', label: '4小时' },
  { value: '1d', label: '1天' },
];

export default function Backtesting() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<BacktestResult | null>(null);
  const [params, setParams] = useState<BacktestParams>({
    algorithm: 'combined',
    symbol: 'BTCUSDT',
    timeframe: '1h',
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 10000,
    positionSize: 0.1,
    stopLoss: 0.02,
    takeProfit: 0.05,
    marketFlowParams: {
      volumeThreshold: 1.5,
      pricePositionThreshold: 0.3,
      confirmationPeriods: 3,
    },
    vixFixParams: {
      period: 22,
      bollingerPeriod: 20,
      stdDevMultiplier: 2.0,
      threshold: 0.7,
    },
  });

  useEffect(() => {
    loadBacktestResults();
  }, []);

  const loadBacktestResults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('backtest_results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('加载回测结果失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    try {
      setRunning(true);
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // 先从浏览器直接获取Binance K线，避免后端网络限制
      const startTimeMs = new Date(params.startDate).getTime();
      const endTimeMs = new Date(params.endDate).getTime();
      const klRes = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${params.symbol}&interval=${params.timeframe}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=500`);
      const klData = await klRes.json();
      const candles = Array.isArray(klData) ? klData.map((k: any[]) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      })) : [];

      const response = await fetch(`${base}/api/backtest/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...params, candles }),
      });

      if (!response.ok) throw new Error('回测执行失败');
      
      const result = await response.json();
      setSelectedResult(result);
      await loadBacktestResults();
    } catch (error) {
      console.error('回测执行失败:', error);
      alert('回测执行失败，请检查参数设置或时间范围');
    } finally {
      setRunning(false);
    }
  };

  const exportResults = (result: BacktestResult) => {
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backtest_${result.params.symbol}_${result.params.algorithm}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getEquityCurveChart = () => {
    if (!selectedResult) return null;
    
    return {
      labels: selectedResult.equityCurve.map(point => point.date),
      datasets: [
        {
          label: '权益曲线',
          data: selectedResult.equityCurve.map(point => point.value),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.1,
        },
      ],
    };
  };

  const getMonthlyReturnsChart = () => {
    if (!selectedResult) return null;
    
    return {
      labels: selectedResult.monthlyReturns.map(item => item.month),
      datasets: [
        {
          label: '月度收益',
          data: selectedResult.monthlyReturns.map(item => item.return * 100),
          backgroundColor: selectedResult.monthlyReturns.map(item => 
            item.return >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
          ),
          borderColor: selectedResult.monthlyReturns.map(item => 
            item.return >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
          ),
          borderWidth: 1,
        },
      ],
    };
  };

  const getWinLossChart = () => {
    if (!selectedResult) return null;
    
    return {
      labels: ['盈利', '亏损'],
      datasets: [
        {
          data: [selectedResult.winningTrades, selectedResult.losingTrades],
          backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
          borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)'],
          borderWidth: 2,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">历史回测</h1>
          <p className="text-gray-600">使用历史数据测试和优化您的交易策略</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 参数配置面板 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-4">
                <Settings className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-xl font-semibold">回测参数</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">算法选择</label>
                  <select
                    value={params.algorithm}
                    onChange={(e) => setParams({ ...params, algorithm: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    <option value="marketFlow">Market Flow</option>
                    <option value="vixFix">Vix Fix</option>
                    <option value="combined">组合策略</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">交易品种</label>
                  <select
                    value={params.symbol}
                    onChange={(e) => setParams({ ...params, symbol: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    {SYMBOLS.map(symbol => (
                      <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">时间周期</label>
                  <select
                    value={params.timeframe}
                    onChange={(e) => setParams({ ...params, timeframe: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  >
                    {TIMEFRAMES.map(tf => (
                      <option key={tf.value} value={tf.value}>{tf.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                    <input
                      type="date"
                      value={params.startDate}
                      onChange={(e) => setParams({ ...params, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                    <input
                      type="date"
                      value={params.endDate}
                      onChange={(e) => setParams({ ...params, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">初始资金 (USDT)</label>
                    <input
                      type="number"
                      value={params.initialCapital}
                      onChange={(e) => setParams({ ...params, initialCapital: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      min="1000"
                      step="1000"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">仓位大小</label>
                    <input
                      type="number"
                      value={params.positionSize}
                      onChange={(e) => setParams({ ...params, positionSize: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      min="0.01"
                      max="1"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">止损 (%)</label>
                    <input
                      type="number"
                      value={params.stopLoss * 100}
                      onChange={(e) => setParams({ ...params, stopLoss: Number(e.target.value) / 100 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                      min="0.5"
                      max="10"
                      step="0.1"
                    />
                  </div>
                </div>

                <button
                  onClick={runBacktest}
                  disabled={running}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {running ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      运行中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      开始回测
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 历史回测结果 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">历史回测</h3>
                <Filter className="w-4 h-4 text-gray-500" />
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedResult?.id === result.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-sm">{result.params.symbol}</div>
                        <div className="text-xs text-gray-500">{result.params.algorithm}</div>
                      </div>
                      <div className={`text-sm font-semibold ${
                        result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {result.totalReturn >= 0 ? '+' : ''}{(result.totalReturn * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>胜率: {(result.winRate * 100).toFixed(1)}%</div>
                      <div>交易: {result.totalTrades}</div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(result.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 结果展示区域 */}
          <div className="lg:col-span-2">
            {selectedResult ? (
              <div className="space-y-6">
                {/* 关键指标 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">总收益</p>
                        <p className={`text-2xl font-bold ${
                          selectedResult.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {selectedResult.totalReturn >= 0 ? '+' : ''}{(selectedResult.totalReturn * 100).toFixed(2)}%
                        </p>
                      </div>
                      <TrendingUp className={`w-8 h-8 ${
                        selectedResult.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`} />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">胜率</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {(selectedResult.winRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">最大回撤</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {(selectedResult.maxDrawdown * 100).toFixed(2)}%
                        </p>
                      </div>
                      <TrendingDown className="w-8 h-8 text-orange-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">夏普比率</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {selectedResult.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                </div>

                {/* 图表区域 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">权益曲线</h3>
                    <div className="h-64">
                      {getEquityCurveChart() && (
                        <Line data={getEquityCurveChart()!} options={chartOptions} />
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">月度收益</h3>
                    <div className="h-64">
                      {getMonthlyReturnsChart() && (
                        <Bar data={getMonthlyReturnsChart()!} options={chartOptions} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">盈亏分布</h3>
                    <div className="h-64">
                      {getWinLossChart() && (
                        <Doughnut data={getWinLossChart()!} options={{
                          ...chartOptions,
                          plugins: {
                            ...chartOptions.plugins,
                            legend: {
                              position: 'bottom' as const,
                            },
                          },
                        }} />
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">详细统计</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">总交易次数:</span>
                        <span className="font-medium">{selectedResult.totalTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">盈利交易:</span>
                        <span className="font-medium text-green-600">{selectedResult.winningTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">亏损交易:</span>
                        <span className="font-medium text-red-600">{selectedResult.losingTrades}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">平均盈利:</span>
                        <span className="font-medium">${selectedResult.avgWin.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">平均亏损:</span>
                        <span className="font-medium">${selectedResult.avgLoss.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">最大盈利:</span>
                        <span className="font-medium text-green-600">${selectedResult.largestWin.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">最大亏损:</span>
                        <span className="font-medium text-red-600">${selectedResult.largestLoss.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">收益因子:</span>
                        <span className="font-medium">{selectedResult.profitFactor.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 交易记录 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">交易记录</h3>
                    <button
                      onClick={() => exportResults(selectedResult)}
                      className="flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      导出
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入场时间</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出场时间</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">入场价</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出场价</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">盈亏</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">信号强度</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedResult.trades.slice(0, 20).map((trade) => (
                          <tr key={trade.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(trade.entryDate).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(trade.exitDate).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                trade.side === 'long' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {trade.side === 'long' ? '做多' : '做空'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              ${trade.entryPrice.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              ${trade.exitPrice.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <span className={trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} ({trade.pnlPercent >= 0 ? '+' : ''}{(trade.pnlPercent * 100).toFixed(2)}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center">
                                <div className="w-12 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${trade.signalStrength * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs">{(trade.signalStrength * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">选择回测结果</h3>
                <p className="text-gray-600">从左侧历史记录中选择一个回测结果查看详细分析</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
