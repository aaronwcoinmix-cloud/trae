import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SignalCard from '../components/SignalCard';
import MarketTable from '../components/MarketTable';
import SignalHeatmap from '../components/SignalHeatmap';
import { useSignalsStore } from '../stores/signals';
import { Activity, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { signals, marketData, isLoading, fetchSignals, fetchMarketData, connectSocket, disconnectSocket } = useSignalsStore();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    connectSocket();
    // 初始加载数据
    fetchSignals();
    fetchMarketData();
    setLastUpdate(new Date());

    // 设置定时刷新
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchSignals();
        fetchMarketData();
        setLastUpdate(new Date());
      }, 5000); // 每5秒刷新一次
    }

    return () => {
      if (interval) clearInterval(interval);
      disconnectSocket();
    };
  }, [autoRefresh, fetchSignals, fetchMarketData, connectSocket, disconnectSocket]);

  const handleSignalClick = (symbol: string) => {
    navigate(`/signal/${symbol}`);
  };

  const handleHeatmapClick = (symbol: string) => {
    navigate(`/signal/${symbol}`);
  };

  const handleRefresh = () => {
    fetchSignals();
    fetchMarketData();
    setLastUpdate(new Date());
  };

  // 统计信息
  const totalSignals = signals.length;
  const strongSignals = signals.filter(s => s.strength >= 0.7).length;
  const buySignals = signals.filter(s => s.signal_type === 'buy').length;
  const sellSignals = signals.filter(s => s.signal_type === 'sell').length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* 页面标题和控制 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">实时监控面板</h1>
            <p className="text-gray-400 mt-1">
              基于 Market Flow 和 Vix Fix 算法的合约信号监控
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">
                最后更新: {lastUpdate ? lastUpdate.toLocaleTimeString('zh-CN') : '--'}
              </span>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm">刷新</span>
            </button>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-300">自动刷新</span>
            </label>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-blue-900/50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">活跃信号</p>
                <p className="text-2xl font-bold text-white">{totalSignals}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-green-900/50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">强势信号</p>
                <p className="text-2xl font-bold text-white">{strongSignals}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-green-900/50 rounded-lg">
                <div className="h-6 w-6 bg-green-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">B</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">买入信号</p>
                <p className="text-2xl font-bold text-white">{buySignals}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center">
              <div className="p-3 bg-red-900/50 rounded-lg">
                <div className="h-6 w-6 bg-red-400 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">卖出信号</p>
                <p className="text-2xl font-bold text-white">{sellSignals}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 信号热力图 */}
        <SignalHeatmap 
          signals={signals} 
          onCellClick={handleHeatmapClick}
        />

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 信号列表 */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="px-6 py-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">最新信号</h3>
                <p className="text-sm text-gray-400 mt-1">按时间倒序排列的合约交易信号</p>
              </div>
              
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
                {signals.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">暂无活跃信号</p>
                    <p className="text-sm text-gray-500 mt-1">系统正在实时监控市场...</p>
                  </div>
                ) : (
                  signals.slice(0, 10).map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      onClick={() => handleSignalClick(signal.symbol)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 市场数据 */}
          <div>
            <MarketTable data={marketData} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
