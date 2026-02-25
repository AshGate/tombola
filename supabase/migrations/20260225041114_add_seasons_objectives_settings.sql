/*
  # Add seasons, objectives, settings, and alerts tables

  1. New Tables
    - `seasons`
      - `id` (uuid, primary key)
      - `name` (text) - season display name
      - `started_at` (timestamptz) - when the season began
      - `ended_at` (timestamptz, nullable) - when the season was closed
      - `total_tickets` (integer) - total tickets sold during season
      - `total_gain_employes` (integer) - total employee earnings
      - `total_gain_entreprise` (integer) - total company earnings
      - `total_sales` (integer) - total number of sales
      - `is_active` (boolean) - whether this is the current season
      - `created_at` (timestamptz)

    - `season_sales` - archived sales linked to a season
      - `id` (uuid, primary key)
      - `season_id` (uuid, FK to seasons)
      - `seller_id` (text)
      - `nom`, `prenom`, `numero` (text)
      - `quantite` (integer)
      - `gain_employe`, `gain_entreprise` (integer)
      - `created_at` (timestamptz)

    - `objectives`
      - `id` (uuid, primary key)
      - `guild_id` (text)
      - `monthly_ticket_goal` (integer)
      - `created_at`, `updated_at` (timestamptz)

    - `alert_rules`
      - `id` (uuid, primary key)
      - `guild_id` (text)
      - `type` (text) - 'tickets_per_hour' or 'balance_threshold'
      - `threshold` (integer)
      - `enabled` (boolean)
      - `created_at`, `updated_at` (timestamptz)

  2. Modified Tables
    - `bot_config` - add columns for configurable pricing and recap hour
      - `prix_ticket` (integer, default 1500)
      - `gain_employe_par_ticket` (integer, default 400)
      - `gain_entreprise_par_ticket` (integer, default 1100)
      - `recap_hour` (integer, default 17)

  3. Security
    - Enable RLS on all new tables
    - No public policies (service_role access only from backend)
*/

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_tickets integer NOT NULL DEFAULT 0,
  total_gain_employes integer NOT NULL DEFAULT 0,
  total_gain_entreprise integer NOT NULL DEFAULT 0,
  total_sales integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- Season sales (archived sales per season)
CREATE TABLE IF NOT EXISTS season_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id),
  seller_id text NOT NULL,
  nom text NOT NULL DEFAULT '',
  prenom text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  quantite integer NOT NULL DEFAULT 0,
  gain_employe integer NOT NULL DEFAULT 0,
  gain_entreprise integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE season_sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_season_sales_season_id ON season_sales (season_id);
CREATE INDEX IF NOT EXISTS idx_season_sales_seller_id ON season_sales (seller_id);

-- Objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  monthly_ticket_goal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  threshold integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

-- Add configurable settings to bot_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_config' AND column_name = 'prix_ticket'
  ) THEN
    ALTER TABLE bot_config ADD COLUMN prix_ticket integer NOT NULL DEFAULT 1500;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_config' AND column_name = 'gain_employe_par_ticket'
  ) THEN
    ALTER TABLE bot_config ADD COLUMN gain_employe_par_ticket integer NOT NULL DEFAULT 400;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_config' AND column_name = 'gain_entreprise_par_ticket'
  ) THEN
    ALTER TABLE bot_config ADD COLUMN gain_entreprise_par_ticket integer NOT NULL DEFAULT 1100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bot_config' AND column_name = 'recap_hour'
  ) THEN
    ALTER TABLE bot_config ADD COLUMN recap_hour integer NOT NULL DEFAULT 17;
  END IF;
END $$;
