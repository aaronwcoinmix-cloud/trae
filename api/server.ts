import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import signalsRoutes from './routes/signals';
import marketRoutes from './routes/market';
import settingsRoutes from './routes/settings';
import backtestRoutes from './routes/backtest';
import notificationsRoutes from './routes/notifications';
import networkRoutes from './routes/network';
import { SignalEngine } from './algorithms/signalEngine';
import { binanceService } from './services/binanceService';
import { supabase } from './config/supabase';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:5173'],
    methods: ['GET', 'POST']
  }
});

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.com' 
    : 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API路由
app.use('/api/signals', signalsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/network', networkRoutes);

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('客户端已连接:', socket.id);
  
  // 加入信号更新房间
  socket.on('join_signals', () => {
    socket.join('signals_room');
    console.log(`客户端 ${socket.id} 加入信号房间`);
  });
  
  // 离开信号更新房间
  socket.on('leave_signals', () => {
    socket.leave('signals_room');
    console.log(`客户端 ${socket.id} 离开信号房间`);
  });
  
  socket.on('disconnect', () => {
    console.log('客户端已断开连接:', socket.id);
  });
});

// 全局错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: '接口不存在',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});

// 创建信号引擎实例
const signalEngine = new SignalEngine({
  batchSize: 10,
  analysisInterval: 5 * 60 * 1000, // 5分钟
  maxConcurrentAnalyses: 5,
  signalExpirationHours: 24
});

// 初始化服务
async function initializeServices() {
  try {
    console.log('正在初始化服务...');
    
    // 同步交易对数据
    await syncSymbolsData();
    // 初次更新价格数据，确保前端可见真实行情
    await updateSymbolsPrices();
    
    // 启动信号引擎
    await signalEngine.start();
    
    // 设置定时任务
    setupCronJobs();
    
    console.log('服务初始化完成');
  } catch (error) {
    console.error('服务初始化失败:', error);
  }
}

// 同步交易对数据
async function syncSymbolsData() {
  try {
    console.log('正在同步交易对数据...');
    
    // 从Binance获取最新的USDT永续合约交易对
    const binanceSymbols = await binanceService.getUSDTMFuturesSymbols();
    
    if (binanceSymbols.length === 0) {
      console.log('未能从Binance获取交易对数据');
      return;
    }

    // 获取当前数据库中的交易对
    const { data: existingSymbols } = await supabase
      .from('symbols')
      .select('symbol, id');

    const existingSymbolMap = new Map(
      (existingSymbols || []).map(s => [s.symbol, s.id])
    );

    // 准备要插入或更新的数据
    const now = new Date().toISOString();
    const symbolsToUpsert = binanceSymbols.map(symbol => ({
      ...symbol,
      id: existingSymbolMap.get(symbol.symbol) || symbol.id,
      last_updated: now
    }));

    // 批量插入或更新交易对
    const { error } = await supabase
      .from('symbols')
      .upsert(symbolsToUpsert, { onConflict: 'symbol' });

    if (error) {
      console.error('同步交易对数据失败:', error);
      return;
    }

    console.log(`成功同步 ${symbolsToUpsert.length} 个交易对`);
  } catch (error) {
    console.error('同步交易对数据异常:', error);
  }
}

// 设置定时任务
function setupCronJobs() {
  // 每小时同步一次交易对数据
  cron.schedule('0 * * * *', async () => {
    console.log('开始定时同步交易对数据...');
    await syncSymbolsData();
  });

  // 每天凌晨2点清理过期信号
  cron.schedule('0 2 * * *', async () => {
    console.log('开始清理过期信号...');
    await signalEngine.cleanupExpiredSignals();
  });

  // 每5分钟更新交易对价格数据
  cron.schedule('*/5 * * * *', async () => {
    console.log('开始更新交易对价格数据...');
    await updateSymbolsPrices();
  });
}

// 更新交易对价格数据
async function updateSymbolsPrices() {
  try {
    // 获取所有活跃交易对
    const { data: symbols } = await supabase
      .from('symbols')
      .select('*')
      .eq('is_active', true)
      .limit(100);

    if (!symbols || symbols.length === 0) {
      return;
    }

    // 从Binance获取最新价格数据
    const updatedSymbols = await binanceService.updateSymbolsData(symbols);

    // 批量更新数据库
    const { error } = await supabase
      .from('symbols')
      .upsert(updatedSymbols);

    if (error) {
      console.error('更新交易对价格数据失败:', error);
      return;
    }

    console.log(`成功更新 ${updatedSymbols.length} 个交易对的价格数据`);
  } catch (error) {
    console.error('更新交易对价格数据异常:', error);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务...');
  
  // 停止信号引擎
  signalEngine.stop();
  
  // 断开所有WebSocket连接
  binanceService.disconnectAllWebSockets();
  
  // 关闭服务器
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('正在关闭服务...');
  
  // 停止信号引擎
  signalEngine.stop();
  
  // 断开所有WebSocket连接
  binanceService.disconnectAllWebSockets();
  
  // 关闭服务器
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

// 启动服务
initializeServices();

// 导出io实例供其他模块使用
export { io };

export default app;

const port = process.env.PORT || 3001;
app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));