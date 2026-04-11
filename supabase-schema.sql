-- Create chats table for storing user conversations
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for storing chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notion_content table for storing Notion data
CREATE TABLE IF NOT EXISTS notion_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_id TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gdocs_content table for storing Google Docs data
CREATE TABLE IF NOT EXISTS gdocs_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  doc_id TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdocs_content ENABLE ROW LEVEL SECURITY;

-- Create policies for chats
CREATE POLICY "Users can view their own chats" ON chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chats" ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chats" ON chats
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chats" ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for messages
CREATE POLICY "Users can view messages from their chats" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their chats" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their chats" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    )
  );

-- Create policies for notion_content
CREATE POLICY "Users can view their own notion content" ON notion_content
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notion content" ON notion_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notion content" ON notion_content
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notion content" ON notion_content
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for gdocs_content
CREATE POLICY "Users can view their own gdocs content" ON gdocs_content
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gdocs content" ON gdocs_content
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gdocs content" ON gdocs_content
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gdocs content" ON gdocs_content
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_notion_content_user_id ON notion_content(user_id);
CREATE INDEX idx_gdocs_content_user_id ON gdocs_content(user_id);
