-- Create table to store default page selections per workspace/chat
CREATE TABLE IF NOT EXISTS chat_page_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one record per user+workspace+page combination
  UNIQUE(user_id, workspace_id, page_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_page_defaults_user_workspace 
  ON chat_page_defaults(user_id, workspace_id);

-- Create index for faster lookups by page_id
CREATE INDEX IF NOT EXISTS idx_chat_page_defaults_page_id 
  ON chat_page_defaults(user_id, page_id);

-- Enable RLS
ALTER TABLE chat_page_defaults ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/modify their own defaults
CREATE POLICY "Users can manage their own page defaults"
  ON chat_page_defaults
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
