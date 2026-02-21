/*
  # Create sales table for Discord raffle bot

  1. New Tables
    - `sales`
      - `id` (uuid, primary key)
      - `seller_id` (text) - Discord ID of the seller
      - `nom` (text) - Last name
      - `prenom` (text) - First name
      - `numero` (text) - Phone/ticket number
      - `quantite` (integer) - Number of tickets sold
      - `gain_employe` (integer) - Employee gain: quantity * 400
      - `gain_entreprise` (integer) - Company gain: quantity * 1100
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `sales` table
    - Add separate policies for anon and service_role access
    - Index on seller_id for performance
*/

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  numero text NOT NULL,
  quantite integer NOT NULL DEFAULT 0,
  gain_employe integer NOT NULL DEFAULT 0,
  gain_entreprise integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Service role has full access to sales"
  ON sales
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);