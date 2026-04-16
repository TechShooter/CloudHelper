-- Migration to add chat sidebar feature
-- This script drops and recreates the chats table to avoid conflicts

-- Step 1: Drop chats table if it exists (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS chats CASCADE;

-- Step 2: Create the new chats table
CREATE TABLE chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add chat_id column to chat_messages if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'chat_id'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN chat_id UUID REFERENCES chats(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX idx_chats_user_workspace ON chats(user_id, workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_chat ON chat_messages(user_id, chat_id, created_at);

-- Step 5: Enable RLS on chats table
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for chats table
CREATE POLICY "Users can view own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- Step 7: Create/update function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for updated_at on chats
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
