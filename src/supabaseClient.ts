import { createClient } from '@supabase/supabase-js';

// URL Supabase lấy từ dự án của bạn
const SUPABASE_URL = 'https://fmjwtdrkombtruveltbh.supabase.co';

// LƯU Ý: Thay chuỗi dưới đây bằng anon key trong Supabase Dashboard
// (Vào Supabase -> Project Settings -> API -> copy dòng 'anon / public')
const SUPABASE_ANON_KEY = 'sb_publishable_XC8Gqq0LT4Ge2hmdLmvjlw_sUcw4CEu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);