-- Add second limit column for red meat goals
ALTER TABLE nutrient_goals
  ADD COLUMN IF NOT EXISTS red_meat_limit_2 NUMERIC DEFAULT 0;
