-- AlterTable
ALTER TABLE "cong_viec" ADD COLUMN     "daXoa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ghiChu" TEXT,
ADD COLUMN     "lyDoXoa" TEXT,
ADD COLUMN     "ngayXoa" TIMESTAMP(3),
ADD COLUMN     "nguoiPhoiHop" TEXT[],
ADD COLUMN     "nguoiXoaId" TEXT,
ADD COLUMN     "sanPhamIds" TEXT[];

-- DropEnum
DROP TYPE "TrangThaiGiaiDoan";
