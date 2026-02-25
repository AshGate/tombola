/*
  # Create auth_codes table for Discord DM authentication

  1. New Tables
    - `auth_codes`
      - `id` (uuid, primary key) - unique identifier
      - `discord_id` (text, not null) - Discord user ID requesting auth
      - `code` (text, not null) - 6-digit temporary code
      - `attempts` (integer, default 0) - number of failed verification attempts
      - `expires_at` (timestamptz, not null) - expiration timestamp (5 min after creation)
      - `used` (boolean, default false) - whether the code has been used
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `auth_codes` table
    - No public policies (accessed only via service role from backend)

  3. Notes
    - Codes expire after 5 minutes
    - Maximum 3 verification attempts per code
    - Code is deleted after successful use
*/

CREATE TABLE IF NOT EXISTS auth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id text NOT NULL,
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE auth_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_codes_discord_id ON auth_codes (discord_id);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires_at ON auth_codes (expires_at);
