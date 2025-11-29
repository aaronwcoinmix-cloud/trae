import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://snxsdnlxelzcoqpfrtci.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueHNkbmx4ZWx6Y29xcGZydGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDMzMjk2NSwiZXhwIjoyMDc5OTA4OTY1fQ.__-tf5SrMOI3mzloWXY4nsFkhhgfp2_LxyRE3k_MxAY';

// 服务端使用的Supabase客户端，具有更高权限
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);