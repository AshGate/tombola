/*
  # Create sales table for Discord raffle bot

  1. New Tables
    - `sales`
      - `id` (uuid, primary key) - Unique identifier for each sale
      - `seller_id` (text) - Discord ID of the seller
      - `nom` (text) - Last name
      - `prenom` (text) - First name
      - `numero` (text) - Phone/ticket number
      - `quantite` (integer) - Number of tickets sold
      - `created_at` (timestamptz) - Timestamp when the sale was created
      - `updated_at` (timestamptz) - Timestamp when the sale was last updated

  2. Security
    - Enable RLS on `sales` table
    - Add policy for authenticated service role to manage all data
    - Note: This bot will use service role key for full access
*/

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  numero text NOT NULL,
  quantite integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policy for service role to have full access (the bot will use service role)
CREATE POLICY "Service role has full access"
  ON sales
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create an index on seller_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);