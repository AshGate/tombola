/*
  # Create bot_config and sales_archive tables

  1. New Tables
    - `bot_config`
      - `id` (uuid, primary key) - Unique identifier
      - `guild_id` (text, unique) - Discord server ID
      - `logs_channel_id` (text) - Channel ID for logs
      - `updated_at` (timestamptz) - Last update timestamp
    - `sales_archive`
      - `id` (uuid, primary key) - Unique identifier
      - `seller_id` (text) - Discord ID of the seller
      - `nom` (text) - Client last name
      - `prenom` (text) - Client first name
      - `numero` (text) - Client phone number
      - `quantite` (integer) - Number of tickets sold
      - `gain_employe` (integer) - Employee gain
      - `gain_entreprise` (integer) - Company gain
      - `created_at` (timestamptz) - Original sale timestamp
      - `archived_at` (timestamptz) - When the sale was archived

  2. Security
    - Enable RLS on both tables
    - Service role has full access (bot uses service role key)

  3. Notes
    - bot_config stores per-guild configuration like the logs channel
    - sales_archive preserves all sales permanently, even after :reset
    - sales_archive is append-only for audit trail purposes
*/

CREATE TABLE IF NOT EXISTS bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text UNIQUE NOT NULL,
  logs_channel_id text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access on bot_config"
  ON bot_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS sales_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id text NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  numero text NOT NULL,
  quantite integer NOT NULL DEFAULT 0,
  gain_employe integer NOT NULL DEFAULT 0,
  gain_entreprise integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sales_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access on sales_archive"
  ON sales_archive
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sales_archive_seller_id ON sales_archive(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_archive_created_at ON sales_archive(created_at);
