-- Model Selector v2: flexible sheet-like catalog stored in Supabase
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS model_selector_v2_rows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  sheet_source_id TEXT,
  sheet_source_name TEXT,
  sheet_row_number INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, slug),
  UNIQUE(user_id, sheet_source_id, sheet_source_name, sheet_row_number)
);

CREATE INDEX IF NOT EXISTS idx_model_selector_v2_user_sort
  ON model_selector_v2_rows(user_id, sort_order, updated_at DESC);

ALTER TABLE model_selector_v2_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own model selector v2 rows" ON model_selector_v2_rows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own model selector v2 rows" ON model_selector_v2_rows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own model selector v2 rows" ON model_selector_v2_rows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own model selector v2 rows" ON model_selector_v2_rows
  FOR DELETE USING (auth.uid() = user_id);