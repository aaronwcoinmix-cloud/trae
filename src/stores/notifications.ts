import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'signal' | 'system' | 'warning' | 'info';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;
  isConnected: boolean;
  showNotifications: boolean;
}

interface NotificationActions {
  connect: () => void;
  disconnect: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  toggleNotifications: () => void;
  updateConnectionStatus: (status: boolean) => void;
}

const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,
  isConnected: false,
  showNotifications: false,

  connect: () => {
    const { socket } = get();
    if (socket?.connected) return;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('通知系统已连接');
      set({ isConnected: true });
      newSocket.emit('join_signals');
    });

    newSocket.on('disconnect', () => {
      console.log('通知系统已断开');
      set({ isConnected: false });
    });

    newSocket.on('signals_update', (data) => {
      console.log('收到信号更新:', data);
      if (data.type === 'new_signals' && data.data?.length > 0) {
        data.data.forEach((signal: any) => {
          get().addNotification({
            type: 'signal',
            title: `新${signal.signal_type === 'buy' ? '买入' : '卖出'}信号`,
            message: `${signal.symbol_name} - ${signal.algorithm_name}算法检测到${signal.signal_type === 'buy' ? '买入' : '卖出'}信号`,
            data: signal,
            isRead: false,
          });
        });
      }
    });

    newSocket.on('system_notification', (data) => {
      get().addNotification({
        type: data.type || 'info',
        title: data.title || '系统通知',
        message: data.message,
        data: data.data,
        isRead: false,
      });
    });

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('leave_signals');
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));

    // 显示浏览器通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: newNotification.id,
      });
    }
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  toggleNotifications: () => {
    set((state) => ({ showNotifications: !state.showNotifications }));
  },

  updateConnectionStatus: (status) => {
    set({ isConnected: status });
  },
}));

// 请求浏览器通知权限
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.error('请求通知权限失败:', error);
    }
  }
};

export default useNotificationStore;