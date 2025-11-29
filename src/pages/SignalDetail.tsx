import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { Signal, Symbol } from '../../../shared/types';
import Layout from '../components/Layout';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, DollarSign, Activity } from 'lucide-react';

interface SignalDetail extends Signal {
  symbol: Symbol;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

const SignalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [signal, setSignal] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSignalDetail();
    }
  }, [id]);

  useEffect(() => {
    if (signal && !chartReady) {
      initializeTradingView();
    }
  }, [signal, chartReady]);

  // 获取信号详情
  const fetchSignalDetail = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('signals')
        .select(`
          *,
          symbol:symbols(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('获取信号详情失败:', error);
        return;
      }

      if (data) {
        setSignal(data as SignalDetail);
      }
    } catch (error) {
      console.error('获取信号详情异常:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化TradingView图表
  const initializeTradingView = () => {
    if (!signal) return;

    // 清除之前的图表
    const container = document.getElementById('tradingview-chart');
    if (container) {
      container.innerHTML = '';
    }

    // 创建TradingView组件
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: 'tradingview-chart',
          width: '100%',
          height: 400,
          symbol: signal.symbol.symbol,
          interval: '1H',
          timezone: 'Asia/Shanghai',
          theme: 'dark',
          style: '1',
          locale: 'zh_CN',
          toolbar_bg: '#1a1a1a',
          enable_publishing: false,
          allow_symbol_change: false,
          save_image: false,
          details: true,
          hotlist: false,
          calendar: false,
          news: ['headlines'],
          studies: ['Volume@tv-basicstudies'],
          disabled_features: ['header_symbol_search', 'symbol_search_hot_key'],
          enabled_features: ['study_templates'],
          overrides: {
            'mainSeriesProperties.style': 1,
            'mainSeriesProperties.candleStyle.upColor': '#10b981',
            'mainSeriesProperties.candleStyle.downColor': '#ef4444',
            'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
            'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
            'paneProperties.background': '#1a1a1a',
            'paneProperties.vertGridProperties.color': '#2d2d2d',
            'paneProperties.horzGridProperties.color': '#2d2d2d',
            'scalesProperties.textColor': '#9ca3af',
            'scalesProperties.lineColor': '#374151',
          }
        });
        setChartReady(true);
      }
    };
    
    document.head.appendChild(script);
  };

  // 获取信号类型颜色
  const getSignalTypeColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'sell':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  // 获取强度颜色
  const getStrengthColor = (strength: number) => {
    if (strength >= 0.8) return 'text-green-500';
    if (strength >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 格式化价格
  const formatPrice = (price: number) => {
    return price.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (!signal) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-gray-400 mb-4">信号不存在或已过期</div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回监控面板
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部 */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回监控面板
          </button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold text-white">
                {signal.symbol.symbol}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSignalTypeColor(signal.signal_type)}`}>
                {signal.signal_type === 'buy' ? '买入信号' : signal.signal_type === 'sell' ? '卖出信号' : '中性信号'}
              </span>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                ${formatPrice(signal.price)}
              </div>
              <div className="text-sm text-gray-400">
                信号价格
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：图表 */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">价格图表</h2>
              <div id="tradingview-chart" className="w-full h-96 rounded-lg overflow-hidden" />
            </div>
          </div>

          {/* 右侧：信号详情 */}
          <div className="space-y-6">
            {/* 信号强度 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">信号强度</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">强度评分</span>
                  <span className={`font-semibold ${getStrengthColor(signal.strength)}`}>
                    {(signal.strength * 100).toFixed(1)}%
                  </span>
                </div>
                
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      signal.strength >= 0.8 ? 'bg-green-500' : 
                      signal.strength >= 0.6 ? 'bg-yellow-500' : 'bg-orange-500'
                    }`}
                    style={{ width: `${signal.strength * 100}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">置信度</span>
                  <span className={`font-semibold ${getStrengthColor(signal.confidence)}`}>
                    {(signal.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 算法信息 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">算法信息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">算法名称</span>
                  <span className="text-white font-medium">
                    {signal.algorithm_name === 'market_flow' ? '市场流量' : 
                     signal.algorithm_name === 'vix_fix' ? 'Vix Fix' : signal.algorithm_name}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">信号类型</span>
                  <span className="text-white font-medium capitalize">
                    {signal.signal_type}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">状态</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    signal.status === 'active' ? 'bg-green-500/20 text-green-500' :
                    signal.status === 'expired' ? 'bg-gray-500/20 text-gray-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {signal.status === 'active' ? '活跃' : 
                     signal.status === 'expired' ? '已过期' : '已失效'}
                  </span>
                </div>
              </div>
            </div>

            {/* 时间信息 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">时间信息</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    创建时间
                  </span>
                  <span className="text-white text-sm">
                    {formatTime(signal.created_at)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center">
                    <Activity className="w-4 h-4 mr-2" />
                    更新时间
                  </span>
                  <span className="text-white text-sm">
                    {formatTime(signal.updated_at)}
                  </span>
                </div>
                
                {signal.expires_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 flex items-center">
                      <TrendingDown className="w-4 h-4 mr-2" />
                      过期时间
                    </span>
                    <span className="text-white text-sm">
                      {formatTime(signal.expires_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 元数据 */}
            {signal.metadata && Object.keys(signal.metadata).length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">详细参数</h3>
                <div className="space-y-2">
                  {Object.entries(signal.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-400 capitalize">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="text-white font-mono">
                        {typeof value === 'number' ? value.toFixed(4) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SignalDetail;