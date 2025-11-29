import { create } from 'zustand';
import { Signal, MarketData } from '../../../shared/types';
import { io, Socket } from 'socket.io-client';

interface SignalsState {
  signals: Signal[];
  marketData: MarketData[];
  isLoading: boolean;
  selectedSymbol: string | null;
  fetchSignals: (limit?: number, strength?: string) => Promise<void>;
  fetchMarketData: () => Promise<void>;
  selectSymbol: (symbol: string | null) => void;
  addSignal: (signal: Signal) => void;
  updateMarketData: (data: MarketData) => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useSignalsStore = create<SignalsState>((set, get) => ({
  signals: [],
  marketData: [],
  isLoading: false,
  selectedSymbol: null,

  fetchSignals: async (limit = 50, strength = 'all') => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        strength,
      });
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${base}/api/signals/realtime?${params}`);
      if (!response.ok) throw new Error('获取信号失败');
      
      const data = await response.json();
      set({ signals: data.signals, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      console.error('获取信号失败:', error);
    }
  },

  fetchMarketData: async () => {
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${base}/api/market/data`);
      if (!response.ok) throw new Error('获取市场数据失败');
      
      const data = await response.json();
      set({ marketData: data.data });
    } catch (error) {
      console.error('获取市场数据失败，尝试直接从Binance获取:', error);
      try {
        const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
        const tickers = await res.json();
        const usdtPerp = tickers
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .sort((a: any, b: any) => parseFloat(b.volume) - parseFloat(a.volume))
          .slice(0, 20)
          .map((t: any) => ({
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            price_change_percent: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.volume),
            volume_change: 0,
            last_updated: new Date().toISOString(),
          }));
        set({ marketData: usdtPerp });
      } catch (e) {
        console.error('Binance获取失败:', e);
      }
    }
  },

  selectSymbol: (symbol: string | null) => {
    set({ selectedSymbol: symbol });
  },

  addSignal: (signal: Signal) => {
    set((state) => ({
      signals: [signal, ...state.signals].slice(0, 100), // 保持最多100个信号
    }));
  },

  updateMarketData: (data: MarketData) => {
    set((state) => {
      const existingIndex = state.marketData.findIndex(item => item.symbol === data.symbol);
      const newMarketData = [...state.marketData];
      
      if (existingIndex >= 0) {
        newMarketData[existingIndex] = data;
      } else {
        newMarketData.push(data);
      }
      
      // 按成交量排序，保留前20个
      return {
        marketData: newMarketData
          .sort((a, b) => b.volume - a.volume)
          .slice(0, 20)
      };
    });
  },

  connectSocket: () => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const socket: Socket = io(base, { transports: ['websocket'] });
    socket.on('connect', () => {
      socket.emit('join_signals');
    });
    socket.on('signals_update', (payload: any) => {
      if (payload?.data && Array.isArray(payload.data)) {
        payload.data.forEach((s: any) => {
          get().addSignal({
            id: s.id,
            symbol: s.symbol_name || s.symbol,
            symbol_id: s.symbol_id,
            signal_type: s.signal_type,
            strength: s.strength,
            confidence: s.confidence,
            price: s.price,
            algorithm_name: s.algorithm_name,
            metadata: s.metadata,
            status: s.status,
            expires_at: s.expires_at,
            created_at: s.created_at,
            updated_at: s.updated_at,
          });
        });
      }
    });
    (window as any)._signals_socket = socket;
  },

  disconnectSocket: () => {
    const socket: Socket | undefined = (window as any)._signals_socket;
    if (socket) {
      socket.emit('leave_signals');
      socket.disconnect();
      (window as any)._signals_socket = null;
    }
  }
}));
