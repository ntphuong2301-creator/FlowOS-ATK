-- CreateEnum
CREATE TYPE "LoaiPhuThuocCongViec" AS ENUM ('FINISH_TO_START', 'START_TO_START');

-- AlterTable
ALTER TABLE "cong_viec" ADD COLUMN     "ngayKetThucThucTe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "phu_thuoc_cong_viec" ADD COLUMN     "loai" "LoaiPhuThuocCongViec" NOT NULL DEFAULT 'FINISH_TO_START',
ADD COLUMN     "soNgayBuffer" INTEGER NOT NULL DEFAULT 0;
