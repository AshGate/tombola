/*
  # Add financial gain columns to sales table

  1. Changes
    - `gain_employe` (integer) - Employee gain: quantity * 450
    - `gain_entreprise` (integer) - Company gain: quantity * 1100
    - Both are auto-computed from quantity

  2. Notes
    - Default values set to 0
    - Existing rows will need a one-time update (done below)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'gain_employe'
  ) THEN
    ALTER TABLE sales ADD COLUMN gain_employe integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'gain_entreprise'
  ) THEN
    ALTER TABLE sales ADD COLUMN gain_entreprise integer NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE sales
SET
  gain_employe = quantite * 450,
  gain_entreprise = quantite * 1100
WHERE gain_employe = 0 AND gain_entreprise = 0;