-- Remove Sprint (GiaiDoan) from system, add moTa to CongViec

-- Drop giaiDoanId FK and column from cong_viec
ALTER TABLE "cong_viec" DROP COLUMN IF EXISTS "giaiDoanId";
ALTER TABLE "cong_viec" DROP COLUMN IF EXISTS "mucTieu";

-- Add moTa column to cong_viec
ALTER TABLE "cong_viec" ADD COLUMN IF NOT EXISTS "moTa" TEXT;

-- Drop giai_doan table (it had FK to san_pham and cong_viec; FKs already removed above)
DROP TABLE IF EXISTS "giai_doan";
