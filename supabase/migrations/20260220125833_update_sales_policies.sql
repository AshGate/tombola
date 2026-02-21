/*
  # Update RLS policies for sales table
  
  1. Changes
    - Drop existing service_role policy
    - Add policies for anon role to allow bot operations
    - Enable full CRUD operations for the bot using anon key
  
  2. Security
    - Allows anon role (bot) to perform all operations
    - Suitable for Discord bot with controlled access
*/

DROP POLICY IF EXISTS "Service role has full access" ON sales;

CREATE POLICY "Allow anon to select sales"
  ON sales FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert sales"
  ON sales FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update sales"
  ON sales FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete sales"
  ON sales FOR DELETE
  TO anon
  USING (true);