-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chats table (for multiple conversations per workspace)
CREATE TABLE IF NOT EXISTS chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chats_user_workspace ON chats(user_id, workspace_id, updated_at DESC);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_chat ON chat_messages(user_id, chat_id, created_at);

-- Nutrient entries table
CREATE TABLE IF NOT EXISTS nutrient_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  food TEXT NOT NULL,
  grams NUMERIC NOT NULL,
  cost NUMERIC DEFAULT 0,
  energy NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fats NUMERIC DEFAULT 0,
  saturated_fats NUMERIC DEFAULT 0,
  fibers NUMERIC DEFAULT 0,
  sugars NUMERIC DEFAULT 0,
  salt NUMERIC DEFAULT 0,
  vitamin_d NUMERIC DEFAULT 0,
  vitamin_b1 NUMERIC DEFAULT 0,
  vitamin_b2 NUMERIC DEFAULT 0,
  vitamin_b3 NUMERIC DEFAULT 0,
  vitamin_b5 NUMERIC DEFAULT 0,
  vitamin_b6 NUMERIC DEFAULT 0,
  vitamin_b9 NUMERIC DEFAULT 0,
  vitamin_e NUMERIC DEFAULT 0,
  vitamin_k NUMERIC DEFAULT 0,
  calcium NUMERIC DEFAULT 0,
  iron NUMERIC DEFAULT 0,
  phosphorus NUMERIC DEFAULT 0,
  magnesium NUMERIC DEFAULT 0,
  potassium NUMERIC DEFAULT 0,
  zinc NUMERIC DEFAULT 0,
  copper NUMERIC DEFAULT 0,
  manganese NUMERIC DEFAULT 0,
  selenium NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrient_entries_user_time ON nutrient_entries(user_id, time DESC);

-- Nutrient goals table
CREATE TABLE IF NOT EXISTS nutrient_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  energy_kj NUMERIC DEFAULT 8000,
  protein NUMERIC DEFAULT 150,
  carbs NUMERIC DEFAULT 200,
  fats NUMERIC DEFAULT 65,
  saturated_fats NUMERIC DEFAULT 20,
  fibers NUMERIC DEFAULT 25,
  sugars NUMERIC DEFAULT 50,
  salt NUMERIC DEFAULT 6,
  vitamin_d NUMERIC DEFAULT 10,
  vitamin_b1 NUMERIC DEFAULT 1.2,
  vitamin_b2 NUMERIC DEFAULT 1.3,
  vitamin_b3 NUMERIC DEFAULT 16,
  vitamin_b5 NUMERIC DEFAULT 5,
  vitamin_b6 NUMERIC DEFAULT 1.3,
  vitamin_b9 NUMERIC DEFAULT 400,
  vitamin_e NUMERIC DEFAULT 12,
  vitamin_k NUMERIC DEFAULT 70,
  calcium NUMERIC DEFAULT 800,
  iron NUMERIC DEFAULT 14,
  phosphorus NUMERIC DEFAULT 700,
  magnesium NUMERIC DEFAULT 320,
  potassium NUMERIC DEFAULT 2000,
  zinc NUMERIC DEFAULT 8,
  copper NUMERIC DEFAULT 0.9,
  manganese NUMERIC DEFAULT 2,
  selenium NUMERIC DEFAULT 55,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Weight history table
CREATE TABLE IF NOT EXISTS weight_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weight_history_user_date ON weight_history(user_id, date DESC);

-- User notes table (for goalsText, notesText)
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL CHECK (note_type IN ('goals', 'general')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, note_type)
);

-- Nutrient notes table (per-nutrient notes)
CREATE TABLE IF NOT EXISTS nutrient_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutrient_key TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, nutrient_key)
);

-- Workspace settings table
CREATE TABLE IF NOT EXISTS workspace_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, workspace_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_settings_user_workspace ON workspace_settings(user_id, workspace_id);

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat messages" ON chat_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat messages" ON chat_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own nutrient entries" ON nutrient_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrient entries" ON nutrient_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrient entries" ON nutrient_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrient entries" ON nutrient_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own nutrient goals" ON nutrient_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrient goals" ON nutrient_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrient goals" ON nutrient_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrient goals" ON nutrient_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own weight history" ON weight_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight history" ON weight_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight history" ON weight_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight history" ON weight_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own user notes" ON user_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user notes" ON user_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user notes" ON user_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user notes" ON user_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own nutrient notes" ON nutrient_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrient notes" ON nutrient_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nutrient notes" ON nutrient_notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrient notes" ON nutrient_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own workspace settings" ON workspace_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspace settings" ON workspace_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspace settings" ON workspace_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspace settings" ON workspace_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Functions to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrient_entries_updated_at BEFORE UPDATE ON nutrient_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrient_goals_updated_at BEFORE UPDATE ON nutrient_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weight_history_updated_at BEFORE UPDATE ON weight_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nutrient_notes_updated_at BEFORE UPDATE ON nutrient_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_settings_updated_at BEFORE UPDATE ON workspace_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
