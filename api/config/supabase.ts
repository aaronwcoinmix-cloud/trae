import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.SUPABASE_URL || '';
let supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
let supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// 回退到前端配置（仅用于开发环境）
if (!supabaseUrl || !supabaseAnonKey) {
  supabaseUrl = 'https://snxsdnlxelzcoqpfrtci.supabase.co';
  supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueHNkbmx4ZWx6Y29xcGZydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI5NjUsImV4cCI6MjA3OTkwODk2NX0.S6q__XKhgty8V4mYxSUe4qoQ5KTXZgjGzqS1beQk3Tc';
}

// 创建客户端实例
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 创建服务端实例（具有更高权限）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

export default supabase;
