-- Mahlzeit: backfill category + vegetarian flag for the existing 9 kebap
-- dishes of restaurant 00jnzdajm200jnzd.
-- Requires migration 003_dish_metadata.sql to have run first.
-- Descriptions are left untouched (the kebap menu had no ingredient list).
-- Idempotent: safe to re-run.
SET NAMES utf8mb4;
START TRANSACTION;
SET @rid = '00jnzdajm200jnzd';

UPDATE dishes SET category = 'Kebap', is_vegetarian = 0 WHERE id = 'ug8tov7ej6ug8tov' AND restaurant_id = @rid; -- Kebap
UPDATE dishes SET category = 'Kebap', is_vegetarian = 0 WHERE id = 'rkqjk8yqa4rkqjk8' AND restaurant_id = @rid; -- Kebap Jumbo
UPDATE dishes SET category = 'Kebap', is_vegetarian = 1 WHERE id = 'xm1mu9eadexm1mu9' AND restaurant_id = @rid; -- Kebap Veggie
UPDATE dishes SET category = 'Kebap', is_vegetarian = 1 WHERE id = '3a5ch5yy7j3a5ch5' AND restaurant_id = @rid; -- Kebap Falafel
UPDATE dishes SET category = 'Dürüm', is_vegetarian = 0 WHERE id = 'ixruphcx54ixruph' AND restaurant_id = @rid; -- Dürüm
UPDATE dishes SET category = 'Dürüm', is_vegetarian = 1 WHERE id = '91ltwollk391ltwo' AND restaurant_id = @rid; -- Dürüm Veggie
UPDATE dishes SET category = 'Dürüm', is_vegetarian = 1 WHERE id = '0i0xqibvze0i0xqi' AND restaurant_id = @rid; -- Dürüm Falafel
UPDATE dishes SET category = 'Box',   is_vegetarian = 0 WHERE id = 'f9c2u40l2xf9c2u4' AND restaurant_id = @rid; -- Kebap Box klein
UPDATE dishes SET category = 'Box',   is_vegetarian = 0 WHERE id = '58p37b04um58p37b' AND restaurant_id = @rid; -- Kebap Box groß

COMMIT;
