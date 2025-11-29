import React from 'react';
import Layout from '../components/Layout';

const Backtest: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">历史回测</h1>
            <p className="text-gray-400 mt-1">策略历史表现和参数优化</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-4">功能开发中</h2>
          <p className="text-gray-400">历史回测页面正在开发中，将包含：</p>
          <ul className="text-gray-400 mt-2 space-y-1">
            <li>• 策略历史收益率统计</li>
            <li>• 胜率和最大回撤分析</li>
            <li>• 参数优化工具</li>
            <li>• 多周期回测对比</li>
            <li>• 风险收益指标</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default Backtest;