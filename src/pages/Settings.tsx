import React, { useState, useEffect } from 'react';
 
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  Settings as SettingsIcon, 
  Bell, 
  BellOff, 
  Save, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Sliders,
  TrendingUp,
  Activity,
  Mail,
  Smartphone,
  DollarSign,
  Clock,
  Target,
  Volume2,
  BarChart3
} from 'lucide-react';

interface AlgorithmParams {
  marketFlow: {
    volumeThreshold: number;
    pricePositionThreshold: number;
    confirmationPeriods: number;
    enabled: boolean;
  };
  vixFix: {
    period: number;
    bollingerPeriod: number;
    stdDevMultiplier: number;
    threshold: number;
    enabled: boolean;
  };
}

interface NotificationSettings {
  signal_notifications: boolean;
  system_notifications: boolean;
  browser_notifications: boolean;
  email_notifications: boolean;
  signal_types: string[];
  min_signal_strength: number;
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface SubscriptionSettings {
  plan: 'free' | 'basic' | 'premium' | 'professional';
  maxSignalsPerDay: number;
  maxBacktestsPerMonth: number;
  realtimeUpdates: boolean;
  advancedAnalytics: boolean;
  expiresAt: string | null;
}

interface SystemSettings {
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  autoRefresh: boolean;
  refreshInterval: number;
  soundEnabled: boolean;
  soundVolume: number;
}

const DEFAULT_ALGORITHM_PARAMS: AlgorithmParams = {
  marketFlow: {
    volumeThreshold: 1.5,
    pricePositionThreshold: 0.3,
    confirmationPeriods: 3,
    enabled: true,
  },
  vixFix: {
    period: 22,
    bollingerPeriod: 20,
    stdDevMultiplier: 2.0,
    threshold: 0.7,
    enabled: true,
  },
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  signal_notifications: true,
  system_notifications: true,
  browser_notifications: true,
  email_notifications: false,
  signal_types: ['buy', 'sell'],
  min_signal_strength: 0.6,
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  }
};

const DEFAULT_SUBSCRIPTION_SETTINGS: SubscriptionSettings = {
  plan: 'free',
  maxSignalsPerDay: 10,
  maxBacktestsPerMonth: 5,
  realtimeUpdates: true,
  advancedAnalytics: false,
  expiresAt: null,
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  timezone: 'Asia/Shanghai',
  language: 'zh-CN',
  theme: 'dark',
  autoRefresh: true,
  refreshInterval: 5,
  soundEnabled: true,
  soundVolume: 0.5,
};

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'algorithm' | 'notifications' | 'subscription' | 'system'>('algorithm');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [algorithmParams, setAlgorithmParams] = useState<AlgorithmParams>(DEFAULT_ALGORITHM_PARAMS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>(DEFAULT_SUBSCRIPTION_SETTINGS);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const saved = localStorage.getItem('panel_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.algorithmParams) setAlgorithmParams(parsed.algorithmParams);
        if (parsed.notificationSettings) setNotificationSettings(parsed.notificationSettings);
        if (parsed.subscriptionSettings) setSubscriptionSettings(parsed.subscriptionSettings);
        if (parsed.systemSettings) setSystemSettings(parsed.systemSettings);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      showMessage('error', '加载设置失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const payload = {
        algorithmParams,
        notificationSettings,
        subscriptionSettings,
        systemSettings,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('panel_settings', JSON.stringify(payload));
      showMessage('success', '设置保存成功');
    } catch (error) {
      console.error('保存设置失败:', error);
      showMessage('error', '保存设置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = (type: 'algorithm' | 'notifications' | 'system') => {
    if (confirm('确定要重置此部分设置吗？')) {
      switch (type) {
        case 'algorithm':
          setAlgorithmParams(DEFAULT_ALGORITHM_PARAMS);
          break;
        case 'notifications':
          setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
          break;
        case 'system':
          setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
          break;
      }
      showMessage('success', '设置已重置');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAlgorithmParamChange = (algorithm: 'marketFlow' | 'vixFix', param: string, value: any) => {
    setAlgorithmParams(prev => ({
      ...prev,
      [algorithm]: {
        ...prev[algorithm],
        [param]: value,
      },
    }));
  };

  const handleNotificationChange = (key: keyof NotificationSettings, setting: string, value: any) => {
    setNotificationSettings(prev => {
      if (setting) {
        // 处理嵌套对象，如 quiet_hours.enabled
        return {
          ...prev,
          [key]: {
            ...prev[key],
            [setting]: value,
          },
        };
      } else {
        // 处理直接属性，如 signal_notifications
        return {
          ...prev,
          [key]: value,
        };
      }
    });
  };

  const handleSystemSettingChange = (setting: keyof SystemSettings, value: any) => {
    setSystemSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center">
            <SettingsIcon className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">系统设置</h1>
              <p className="text-gray-600 mt-1">配置算法参数、通知偏好和系统选项</p>
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* 标签页导航 */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            {[
              { id: 'algorithm', name: '算法参数', icon: BarChart3 },
              { id: 'notifications', name: '通知设置', icon: Bell },
              { id: 'subscription', name: '订阅管理', icon: DollarSign },
              { id: 'system', name: '系统设置', icon: SettingsIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 主要内容区域 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm">
              {/* 算法参数设置 */}
              {activeTab === 'algorithm' && (
                <div className="p-6 space-y-8">
                  {/* Market Flow 参数 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Market Flow 算法</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={algorithmParams.marketFlow.enabled}
                            onChange={(e) => handleAlgorithmParamChange('marketFlow', 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <button
                          onClick={() => resetSettings('algorithm')}
                          className="p-2 text-gray-400 hover:text-gray-600"
                          title="重置算法参数"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          成交量阈值
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="5.0"
                          value={algorithmParams.marketFlow.volumeThreshold}
                          onChange={(e) => handleAlgorithmParamChange('marketFlow', 'volumeThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!algorithmParams.marketFlow.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">相对于平均成交量的倍数</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          价格位置阈值
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1.0"
                          value={algorithmParams.marketFlow.pricePositionThreshold}
                          onChange={(e) => handleAlgorithmParamChange('marketFlow', 'pricePositionThreshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!algorithmParams.marketFlow.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">价格相对于区间的位置</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          确认周期数
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={algorithmParams.marketFlow.confirmationPeriods}
                          onChange={(e) => handleAlgorithmParamChange('marketFlow', 'confirmationPeriods', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={!algorithmParams.marketFlow.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">信号确认所需的K线数量</p>
                      </div>
                    </div>
                  </div>

                  {/* Vix Fix 参数 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Activity className="w-5 h-5 text-green-600 mr-2" />
                        <h3 className="text-lg font-semibold text-gray-900">Vix Fix 算法</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={algorithmParams.vixFix.enabled}
                            onChange={(e) => handleAlgorithmParamChange('vixFix', 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          计算周期
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="50"
                          value={algorithmParams.vixFix.period}
                          onChange={(e) => handleAlgorithmParamChange('vixFix', 'period', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!algorithmParams.vixFix.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">Vix Fix计算周期</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          布林带周期
                        </label>
                        <input
                          type="number"
                          min="10"
                          max="50"
                          value={algorithmParams.vixFix.bollingerPeriod}
                          onChange={(e) => handleAlgorithmParamChange('vixFix', 'bollingerPeriod', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!algorithmParams.vixFix.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">布林带计算周期</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          标准差倍数
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="3.0"
                          value={algorithmParams.vixFix.stdDevMultiplier}
                          onChange={(e) => handleAlgorithmParamChange('vixFix', 'stdDevMultiplier', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!algorithmParams.vixFix.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">布林带标准差倍数</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          信号阈值
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="1.0"
                          value={algorithmParams.vixFix.threshold}
                          onChange={(e) => handleAlgorithmParamChange('vixFix', 'threshold', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={!algorithmParams.vixFix.enabled}
                        />
                        <p className="text-xs text-gray-500 mt-1">信号触发阈值</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 通知设置 */}
              {activeTab === 'notifications' && (
                <div className="p-6 space-y-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <Bell className="w-5 h-5 text-blue-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">通知偏好设置</h3>
                    </div>
                    <button
                      onClick={() => resetSettings('notifications')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="重置通知设置"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* 基础通知设置 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-gray-800">信号通知</h4>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">启用信号通知</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationSettings.signal_notifications}
                              onChange={(e) => handleNotificationChange('signal_notifications', '', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">系统通知</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationSettings.system_notifications}
                              onChange={(e) => handleNotificationChange('system_notifications', '', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">浏览器通知</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationSettings.browser_notifications}
                              onChange={(e) => handleNotificationChange('browser_notifications', '', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-gray-800">信号类型</h4>
                        
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={notificationSettings.signal_types.includes('buy')}
                              onChange={(e) => {
                                const types = e.target.checked 
                                  ? [...notificationSettings.signal_types, 'buy']
                                  : notificationSettings.signal_types.filter(t => t !== 'buy');
                                handleNotificationChange('signal_types', '', types);
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">买入信号</span>
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={notificationSettings.signal_types.includes('sell')}
                              onChange={(e) => {
                                const types = e.target.checked 
                                  ? [...notificationSettings.signal_types, 'sell']
                                  : notificationSettings.signal_types.filter(t => t !== 'sell');
                                handleNotificationChange('signal_types', '', types);
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">卖出信号</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* 信号强度过滤 */}
                    <div>
                      <h4 className="text-md font-medium text-gray-800 mb-3">信号强度过滤</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            最小信号强度: {notificationSettings.min_signal_strength.toFixed(2)}
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={notificationSettings.min_signal_strength}
                            onChange={(e) => handleNotificationChange('min_signal_strength', '', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0.1</span>
                            <span>1.0</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 安静时段 */}
                    <div>
                      <h4 className="text-md font-medium text-gray-800 mb-3">安静时段</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">启用安静时段</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={notificationSettings.quiet_hours.enabled}
                              onChange={(e) => handleNotificationChange('quiet_hours', 'enabled', e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                          </label>
                        </div>

                        {notificationSettings.quiet_hours.enabled && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                开始时间
                              </label>
                              <input
                                type="time"
                                value={notificationSettings.quiet_hours.start}
                                onChange={(e) => handleNotificationChange('quiet_hours', 'start', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                结束时间
                              </label>
                              <input
                                type="time"
                                value={notificationSettings.quiet_hours.end}
                                onChange={(e) => handleNotificationChange('quiet_hours', 'end', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 订阅管理 */}
              {activeTab === 'subscription' && (
                <div className="p-6 space-y-6">
                  <div className="text-center py-8">
                    <DollarSign className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">订阅管理</h3>
                    <p className="text-gray-600 mb-6">管理您的订阅计划和功能权限</p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md mx-auto">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          {subscriptionSettings.plan === 'free' && '免费版'}
                          {subscriptionSettings.plan === 'basic' && '基础版'}
                          {subscriptionSettings.plan === 'premium' && '高级版'}
                          {subscriptionSettings.plan === 'professional' && '专业版'}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>每日信号数量: {subscriptionSettings.maxSignalsPerDay}</div>
                          <div>每月回测次数: {subscriptionSettings.maxBacktestsPerMonth}</div>
                          <div>实时更新: {subscriptionSettings.realtimeUpdates ? '✓' : '✗'}</div>
                          <div>高级分析: {subscriptionSettings.advancedAnalytics ? '✓' : '✗'}</div>
                        </div>
                        {subscriptionSettings.expiresAt && (
                          <div className="text-xs text-gray-500 mt-2">
                            到期时间: {new Date(subscriptionSettings.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      升级订阅
                    </button>
                  </div>
                </div>
              )}

              {/* 系统设置 */}
              {activeTab === 'system' && (
                <div className="p-6 space-y-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <SettingsIcon className="w-5 h-5 text-gray-600 mr-2" />
                      <h3 className="text-lg font-semibold text-gray-900">系统设置</h3>
                    </div>
                    <button
                      onClick={() => resetSettings('system')}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="重置系统设置"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        时区
                      </label>
                      <select
                        value={systemSettings.timezone}
                        onChange={(e) => handleSystemSettingChange('timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Asia/Shanghai">北京时间 (UTC+8)</option>
                        <option value="America/New_York">纽约时间 (UTC-5/-4)</option>
                        <option value="Europe/London">伦敦时间 (UTC+0/+1)</option>
                        <option value="Asia/Tokyo">东京时间 (UTC+9)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        语言
                      </label>
                      <select
                        value={systemSettings.language}
                        onChange={(e) => handleSystemSettingChange('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="zh-CN">简体中文</option>
                        <option value="en-US">English</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        主题
                      </label>
                      <select
                        value={systemSettings.theme}
                        onChange={(e) => handleSystemSettingChange('theme', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="light">浅色</option>
                        <option value="dark">深色</option>
                        <option value="auto">自动</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        自动刷新间隔（秒）
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={systemSettings.refreshInterval}
                        onChange={(e) => handleSystemSettingChange('refreshInterval', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">启用自动刷新</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={systemSettings.autoRefresh}
                          onChange={(e) => handleSystemSettingChange('autoRefresh', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">启用声音</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={systemSettings.soundEnabled}
                          onChange={(e) => handleSystemSettingChange('soundEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {systemSettings.soundEnabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          音量
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={systemSettings.soundVolume}
                          onChange={(e) => handleSystemSettingChange('soundVolume', parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          音量: {Math.round(systemSettings.soundVolume * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 侧边栏 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              
              <div className="space-y-3">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存设置
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (confirm('确定要重置所有设置为默认值吗？')) {
                      setAlgorithmParams(DEFAULT_ALGORITHM_PARAMS);
                      setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
                      setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
                      showMessage('success', '所有设置已重置为默认值');
                    }
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重置所有
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">当前状态</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      algorithmParams.marketFlow.enabled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}></div>
                    Market Flow: {algorithmParams.marketFlow.enabled ? '启用' : '禁用'}
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      algorithmParams.vixFix.enabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                    Vix Fix: {algorithmParams.vixFix.enabled ? '启用' : '禁用'}
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      notificationSettings.signal_notifications ? 'bg-blue-500' : 'bg-gray-300'
                    }`}></div>
                    信号通知: {notificationSettings.signal_notifications ? '启用' : '禁用'}
                  </div>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      notificationSettings.browser_notifications ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                    浏览器通知: {notificationSettings.browser_notifications ? '启用' : '禁用'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
