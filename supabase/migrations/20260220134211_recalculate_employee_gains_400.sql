/*
  # Recalculate employee gains to 400$/ticket

  1. Changes
    - Updates `gain_employe` for all existing rows in `sales` table
    - New formula: gain_employe = quantite * 400 (was 450)
    - `gain_entreprise` remains unchanged at quantite * 1100

  2. Important Notes
    - This is a data-only migration, no schema changes
    - All future calculations use the updated constant in application code
*/

UPDATE sales
SET gain_employe = quantite * 400
WHERE gain_employe != quantite * 400;
