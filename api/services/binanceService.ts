import axios from 'axios';
import { Symbol } from '../../../shared/types';
import WebSocket from 'ws';

interface BinanceTickerData {
  symbol: string;
  price: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

interface BinanceKlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export class BinanceService {
  private baseURL = 'https://api.binance.com/api/v3';
  private futuresURL = 'https://fapi.binance.com/fapi/v1';
  private wsBaseURL = 'wss://stream.binance.com:9443/ws';
  private wsFuturesURL = 'wss://fstream.binance.com/ws';
  
  private apiKey: string;
  private secretKey: string;
  private wsConnections: Map<string, WebSocket> = new Map();

  constructor(apiKey?: string, secretKey?: string) {
    this.apiKey = apiKey || '';
    this.secretKey = secretKey || '';
  }

  // 获取USDT永续合约交易对列表
  async getUSDTMFuturesSymbols(): Promise<Symbol[]> {
    try {
      const response = await axios.get(`${this.futuresURL}/exchangeInfo`);
      const symbols = response.data.symbols;

      // 筛选USDT永续合约
      const usdtSymbols = symbols
        .filter((symbol: any) => 
          symbol.status === 'TRADING' && 
          symbol.quoteAsset === 'USDT' &&
          symbol.contractType === 'PERPETUAL'
        )
        .map((symbol: any) => ({
          id: symbol.symbol,
          symbol: symbol.symbol,
          base_asset: symbol.baseAsset,
          quote_asset: symbol.quoteAsset,
          contract_type: symbol.contractType,
          status: symbol.status,
          is_active: true,
          current_price: 0,
          price_change_24h: 0,
          price_change_percent_24h: 0,
          volume_24h: 0,
          high_24h: 0,
          low_24h: 0,
          open_price_24h: 0,
          last_updated: new Date().toISOString()
        }));

      return usdtSymbols;
    } catch (error) {
      console.error('获取USDT永续合约交易对失败:', error);
      return [];
    }
  }

  // 获取24小时价格变动统计
  async get24hrTicker(symbol: string): Promise<BinanceTickerData | null> {
    try {
      const response = await axios.get(`${this.futuresURL}/ticker/24hr`, {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      console.error(`获取${symbol}24小时统计数据失败:`, error);
      return null;
    }
  }

  // 批量获取24小时价格变动统计
  async get24hrTickers(symbols: string[]): Promise<BinanceTickerData[]> {
    try {
      // Futures 24hr endpoint不支持 symbols 参数，直接获取全量后筛选
      const response = await axios.get(`${this.futuresURL}/ticker/24hr`);
      const allTickers: BinanceTickerData[] = response.data;
      if (!symbols || symbols.length === 0) return allTickers;
      const set = new Set(symbols.map(s => s.toUpperCase()));
      return allTickers.filter(t => set.has(t.symbol.toUpperCase()));
    } catch (error) {
      console.error('获取24小时统计数据失败:', error);
      return [];
    }
  }

  // 获取K线数据
  async getKlines(
    symbol: string, 
    interval: string = '1h', 
    limit: number = 100,
    startTime?: number,
    endTime?: number
  ): Promise<BinanceKlineData[]> {
    try {
      const params: any = {
        symbol,
        interval,
        limit: Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000)
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.futuresURL}/klines`, { params });
      
      return response.data.map((kline: any[]) => ({
        openTime: kline[0],
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseAssetVolume: kline[9],
        takerBuyQuoteAssetVolume: kline[10]
      }));
    } catch (error) {
      console.error(`获取${symbol}K线数据失败:`, error);
      return [];
    }
  }

  // 获取当前价格
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await axios.get(`${this.futuresURL}/ticker/price`, {
        params: { symbol }
      });
      return parseFloat(response.data.price);
    } catch (error) {
      console.error(`获取${symbol}当前价格失败:`, error);
      return 0;
    }
  }

  // 获取订单簿深度
  async getOrderBookDepth(symbol: string, limit: number = 100): Promise<any> {
    try {
      const response = await axios.get(`${this.futuresURL}/depth`, {
        params: { symbol, limit }
      });
      return response.data;
    } catch (error) {
      console.error(`获取${symbol}订单簿深度失败:`, error);
      return null;
    }
  }

  // 获取资金费率
  async getFundingRate(symbol?: string): Promise<any> {
    try {
      const params: any = {};
      if (symbol) params.symbol = symbol;
      
      const response = await axios.get(`${this.futuresURL}/fundingRate`, { params });
      return response.data;
    } catch (error) {
      console.error('获取资金费率失败:', error);
      return null;
    }
  }

  // 获取持仓量
  async getOpenInterest(symbol: string): Promise<any> {
    try {
      const response = await axios.get(`${this.futuresURL}/openInterest`, {
        params: { symbol }
      });
      return response.data;
    } catch (error) {
      console.error(`获取${symbol}持仓量失败:`, error);
      return null;
    }
  }

  // WebSocket连接管理
  connectWebSocket(streamName: string, onMessage: (data: any) => void): WebSocket | null {
    try {
      // 如果已存在连接，先关闭
      this.disconnectWebSocket(streamName);

      const ws = new WebSocket(`${this.wsFuturesURL}/${streamName}`);
      
      ws.onopen = () => {
        console.log(`WebSocket连接已建立: ${streamName}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('WebSocket消息解析失败:', error);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket错误: ${streamName}`, error);
      };

      ws.onclose = () => {
        console.log(`WebSocket连接已关闭: ${streamName}`);
        this.wsConnections.delete(streamName);
      };

      // Binance 要求收到 ping 时回复 pong
      ws.on('ping', (data) => {
        try {
          ws.pong(data);
        } catch (e) {
          console.error('发送pong失败:', e);
        }
      });

      this.wsConnections.set(streamName, ws);
      return ws;
    } catch (error) {
      console.error(`WebSocket连接失败: ${streamName}`, error);
      return null;
    }
  }

  // 断开WebSocket连接
  disconnectWebSocket(streamName: string): void {
    const ws = this.wsConnections.get(streamName);
    if (ws) {
      ws.close();
      this.wsConnections.delete(streamName);
    }
  }

  // 断开所有WebSocket连接
  disconnectAllWebSockets(): void {
    for (const [streamName, ws] of this.wsConnections) {
      ws.close();
    }
    this.wsConnections.clear();
  }

  // 订阅实时价格更新
  subscribeToPriceUpdates(symbols: string[], callback: (data: any) => void): void {
    if (symbols.length === 0) return;

    // 创建流名称
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/');
    const streamName = `stream?streams=${streams}`;

    this.connectWebSocket(streamName, (data: any) => {
      if (data.stream) {
        // 多路复用流数据
        callback(data);
      } else {
        // 单一流数据
        callback(data);
      }
    });
  }

  // 订阅K线数据
  subscribeToKlines(symbols: string[], interval: string, callback: (data: any) => void): void {
    if (symbols.length === 0) return;

    // 创建流名称
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@kline_${interval}`).join('/');
    const streamName = `stream?streams=${streams}`;

    this.connectWebSocket(streamName, (data: any) => {
      callback(data);
    });
  }

  // 订阅深度数据
  subscribeToDepth(symbols: string[], levels: number = 5, callback: (data: any) => void): void {
    if (symbols.length === 0) return;

    // 创建流名称
    const streams = symbols.map(symbol => `${symbol.toLowerCase()}@depth${levels}`).join('/');
    const streamName = `stream?streams=${streams}`;

    this.connectWebSocket(streamName, (data: any) => {
      callback(data);
    });
  }

  // 更新数据库中的交易对数据
  async updateSymbolsData(symbols: Symbol[]): Promise<Symbol[]> {
    try {
      // 获取所有交易对的最新数据
      const symbolNames = symbols.map(s => s.symbol);
      const tickers = await this.get24hrTickers(symbolNames);

      if (tickers.length === 0) {
        return symbols;
      }

      // 更新交易对数据
      const updatedSymbols = symbols.map(symbol => {
        const ticker = tickers.find(t => t.symbol === symbol.symbol);
        if (ticker) {
          return {
            ...symbol,
            current_price: parseFloat(ticker.lastPrice),
            price_change_24h: parseFloat(ticker.priceChange),
            price_change_percent_24h: parseFloat(ticker.priceChangePercent),
            volume_24h: parseFloat(ticker.volume),
            high_24h: parseFloat(ticker.highPrice),
            low_24h: parseFloat(ticker.lowPrice),
            open_price_24h: parseFloat(ticker.openPrice),
            last_updated: new Date().toISOString()
          };
        }
        return symbol;
      });

      return updatedSymbols;
    } catch (error) {
      console.error('更新交易对数据失败:', error);
      return symbols;
    }
  }

  // 获取历史K线数据（用于回测）
  async getHistoricalKlines(
    symbol: string,
    interval: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<any[]> {
    try {
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const allData: any[] = [];
      
      // 计算每个请求的时间范围
      const intervalMs = this.getIntervalMs(interval);
      const maxDataPoints = limit;
      
      let currentStartTime = startTime;
      
      while (currentStartTime < endTime) {
        const currentEndTime = Math.min(currentStartTime + (maxDataPoints * intervalMs), endTime);
        
        const response = await this.retryRequest(async () => {
          return await axios.get(`${this.futuresURL}/klines`, {
            params: {
              symbol,
              interval,
              startTime: currentStartTime,
              endTime: currentEndTime,
              limit: maxDataPoints
            }
          });
        });

        if (response.data && response.data.length > 0) {
          const formattedData = response.data.map((kline: any[]) => ({
            openTime: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            closeTime: kline[6],
            quoteAssetVolume: parseFloat(kline[7]),
            numberOfTrades: kline[8],
            takerBuyBaseAssetVolume: parseFloat(kline[9]),
            takerBuyQuoteAssetVolume: parseFloat(kline[10])
          }));
          
          allData.push(...formattedData);
          
          // 更新开始时间为最后一个数据点的时间
          const lastDataPoint = response.data[response.data.length - 1];
          currentStartTime = lastDataPoint[6] + 1; // closeTime + 1ms
          
          // 添加延迟避免API限制
          await this.sleep(100);
        } else {
          break;
        }
      }
      
      // 去重并按时间排序
      const uniqueData = allData.filter((item, index, self) => 
        index === self.findIndex(t => t.openTime === item.openTime)
      ).sort((a, b) => a.openTime - b.openTime);
      
      return uniqueData;
    } catch (error) {
      console.error(`获取${symbol}历史K线数据失败:`, error);
      return [];
    }
  }

  // 获取时间间隔的毫秒数
  private getIntervalMs(interval: string): number {
    const intervalMap: { [key: string]: number } = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000
    };
    
    return intervalMap[interval] || 60 * 60 * 1000; // 默认为1小时
  }

  // 获取服务器时间
  async getServerTime(): Promise<number> {
    try {
      const response = await axios.get(`${this.baseURL}/time`);
      return response.data.serverTime;
    } catch (error) {
      console.error('获取服务器时间失败:', error);
      return Date.now();
    }
  }

  // 获取API限制信息
  getRateLimitInfo(response: any): { limit: number; remaining: number; reset: number } {
    return {
      limit: parseInt(response.headers['x-mbx-used-weight-1m'] || '0'),
      remaining: parseInt(response.headers['x-mbx-order-count-1m'] || '1200'),
      reset: parseInt(response.headers['x-mbx-used-weight-reset-1m'] || '0')
    };
  }

  // 错误处理
  private handleError(error: any, context: string): void {
    if (error.response) {
      // 服务器响应错误
      console.error(`${context} - 服务器错误:`, {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      // 请求发送但没有收到响应
      console.error(`${context} - 网络错误:`, error.request);
    } else {
      // 其他错误
      console.error(`${context} - 错误:`, error.message);
    }
  }

  // 延迟函数
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 重试机制
  async retryRequest<T>(
    fn: () => Promise<T>, 
    retries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        
        console.log(`请求失败，第${i + 1}次重试...`);
        await this.sleep(delay * Math.pow(2, i)); // 指数退避
      }
    }
    
    throw new Error('重试次数已用完');
  }
}

// 创建单例实例
export const binanceService = new BinanceService(
  process.env.BINANCE_API_KEY,
  process.env.BINANCE_SECRET_KEY
);

export default binanceService;
