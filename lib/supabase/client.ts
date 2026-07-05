import { createClient } from "@supabase/supabase-js";

// .env.local が未設定の状態でもビルド/起動時にクラッシュさせず、
// 実際のデータ取得時にエラーとして捕捉できるようにフォールバック値を用いる。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
