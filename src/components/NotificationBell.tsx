import React, { useEffect } from 'react';
import { Bell, X, Check, Wifi, WifiOff } from 'lucide-react';
import useNotificationStore, { requestNotificationPermission } from '../stores/notifications';

const NotificationBell: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isConnected,
    showNotifications,
    connect,
    disconnect,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    toggleNotifications,
  } = useNotificationStore();

  useEffect(() => {
    // 请求浏览器通知权限
    requestNotificationPermission();
    
    // 连接WebSocket
    connect();

    return () => {
      // 组件卸载时断开连接
      disconnect();
    };
  }, [connect, disconnect]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'signal':
        return '📊';
      case 'warning':
        return '⚠️';
      case 'system':
        return '🔔';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'signal':
        return 'bg-blue-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'system':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="relative">
      {/* 通知铃铛按钮 */}
      <button
        onClick={toggleNotifications}
        className="relative p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all duration-200"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {!isConnected && (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
        )}
      </button>

      {/* 通知面板 */}
      {showNotifications && (
        <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50">
          {/* 面板头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">通知</h3>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <button
                onClick={toggleNotifications}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 操作按钮 */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between p-2 border-b border-gray-700">
              <button
                onClick={markAllAsRead}
                className="flex items-center space-x-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <Check className="w-3 h-3" />
                <span>全部标记为已读</span>
              </button>
              <button
                onClick={clearNotifications}
                className="px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                清空
              </button>
            </div>
          )}

          {/* 通知列表 */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无通知</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-750 transition-colors ${
                      !notification.isRead ? 'bg-gray-750 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getNotificationColor(notification.type)} ${
                        !notification.isRead ? 'animate-pulse' : ''
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                            <h4 className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </h4>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                              {formatTime(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 mt-1">
                          {notification.message}
                        </p>
                        {notification.data && (
                          <div className="mt-2 text-xs text-gray-400">
                            <div className="flex items-center space-x-4">
                              <span>强度: {notification.data.strength?.toFixed(2) || 'N/A'}</span>
                              <span>置信度: {notification.data.confidence?.toFixed(2) || 'N/A'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 面板底部 */}
          <div className="p-3 border-t border-gray-700 bg-gray-750 rounded-b-lg">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>共 {notifications.length} 条通知</span>
              <span>{unreadCount} 条未读</span>
            </div>
          </div>
        </div>
      )}

      {/* 点击外部关闭面板 */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-40"
          onClick={toggleNotifications}
        />
      )}
    </div>
  );
};

export default NotificationBell;