import { create } from 'zustand';
import { MarketFlowParams, VixFixParams, AlertSettings } from '../../../shared/types';

interface SettingsState {
  marketFlowParams: MarketFlowParams;
  vixFixParams: VixFixParams;
  alertSettings: AlertSettings;
  updateMarketFlowParams: (params: Partial<MarketFlowParams>) => void;
  updateVixFixParams: (params: Partial<VixFixParams>) => void;
  updateAlertSettings: (settings: Partial<AlertSettings>) => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

const defaultMarketFlowParams: MarketFlowParams = {
  volume_threshold: 1.5,
  price_change_threshold: 0.02,
  time_window: 24,
  smoothing_factor: 0.1,
};

const defaultVixFixParams: VixFixParams = {
  lookback_period: 22,
  bollinger_period: 20,
  bollinger_deviations: 2.0,
  smoothing_period: 3,
};

const defaultAlertSettings: AlertSettings = {
  enabled: true,
  signal_strength: 'medium',
  notification_methods: ['browser'],
  frequency: 'realtime',
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  marketFlowParams: defaultMarketFlowParams,
  vixFixParams: defaultVixFixParams,
  alertSettings: defaultAlertSettings,

  updateMarketFlowParams: (params: Partial<MarketFlowParams>) => {
    set((state) => ({
      marketFlowParams: { ...state.marketFlowParams, ...params },
    }));
  },

  updateVixFixParams: (params: Partial<VixFixParams>) => {
    set((state) => ({
      vixFixParams: { ...state.vixFixParams, ...params },
    }));
  },

  updateAlertSettings: (settings: Partial<AlertSettings>) => {
    set((state) => ({
      alertSettings: { ...state.alertSettings, ...settings },
    }));
  },

  saveSettings: async () => {
    try {
      const state = get();
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_flow_params: state.marketFlowParams,
          vix_fix_params: state.vixFixParams,
          alert_settings: state.alertSettings,
        }),
      });

      if (!response.ok) throw new Error('保存设置失败');
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  },

  loadSettings: async () => {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) return;

      const data = await response.json();
      if (data.market_flow_params) {
        set({ marketFlowParams: data.market_flow_params });
      }
      if (data.vix_fix_params) {
        set({ vixFixParams: data.vix_fix_params });
      }
      if (data.alert_settings) {
        set({ alertSettings: data.alert_settings });
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  },
}));