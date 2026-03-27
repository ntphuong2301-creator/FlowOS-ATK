-- CreateEnum
CREATE TYPE "CapQuyen" AS ENUM ('QUAN_TRI_VIEN', 'TRUONG_NHOM', 'THANH_VIEN', 'QUAN_SAT');

-- CreateEnum
CREATE TYPE "TrangThaiDuAn" AS ENUM ('DANG_HOAT_DONG', 'TAM_DUNG', 'HOAN_THANH', 'DA_LUU_TRU');

-- CreateEnum
CREATE TYPE "KenhSanPham" AS ENUM ('HT', 'TT');

-- CreateEnum
CREATE TYPE "TrangThaiSanPham" AS ENUM ('CHUA_BAT_DAU', 'DANG_PHAT_TRIEN', 'HOAN_THANH', 'HUY');

-- CreateEnum
CREATE TYPE "TrangThaiGiaiDoan" AS ENUM ('CHUA_BAT_DAU', 'DANG_THUC_HIEN', 'HOAN_THANH', 'BI_CHAN');

-- CreateEnum
CREATE TYPE "TrangThaiBuoc" AS ENUM ('CHUA_LAM', 'DANG_LAM', 'BI_CHAN', 'XONG');

-- CreateEnum
CREATE TYPE "TrangThaiCongViec" AS ENUM ('CHUA_LAM', 'DANG_LAM', 'BI_CHAN', 'XONG', 'DA_HUY');

-- CreateEnum
CREATE TYPE "MucUuTien" AS ENUM ('THAP', 'TRUNG_BINH', 'CAO', 'KHAN_CAP');

-- CreateEnum
CREATE TYPE "MucDoCanTro" AS ENUM ('RAT_NGHIEM_TRONG', 'VUA_PHAI', 'NHE');

-- CreateEnum
CREATE TYPE "TrangThaiCanTro" AS ENUM ('MO', 'DANG_XU_LY', 'DA_GIAI_QUYET');

-- CreateEnum
CREATE TYPE "LoaiBinhLuan" AS ENUM ('BINH_LUAN', 'DOI_TRANG_THAI', 'AI');

-- CreateEnum
CREATE TYPE "LoaiPhuThuocBuoc" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateTable
CREATE TABLE "nguoi_dung" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "matKhau" TEXT NOT NULL,
    "capQuyen" "CapQuyen" NOT NULL DEFAULT 'THANH_VIEN',
    "mauAvatar" TEXT,
    "larkUserId" TEXT,
    "larkChatId" TEXT,
    "trangThai" BOOLEAN NOT NULL DEFAULT true,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nguoi_dung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "du_an" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "moTa" TEXT,
    "mau" TEXT NOT NULL DEFAULT '#008264',
    "trangThai" "TrangThaiDuAn" NOT NULL DEFAULT 'DANG_HOAT_DONG',
    "truongNhomId" TEXT,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "du_an_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "san_pham" (
    "id" TEXT NOT NULL,
    "maSp" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "kenh" "KenhSanPham" NOT NULL,
    "huongVi" TEXT,
    "dungTichMl" INTEGER,
    "phLevel" DOUBLE PRECISION,
    "ngayLaunch" TIMESTAMP(3),
    "trangThai" "TrangThaiSanPham" NOT NULL DEFAULT 'CHUA_BAT_DAU',
    "buocRDHienTai" TEXT,
    "buocNapHienTai" TEXT,
    "buocBaoHienTai" TEXT,
    "duAnId" TEXT NOT NULL,
    "nguoiPhuTrachId" TEXT,

    CONSTRAINT "san_pham_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "giai_doan" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "ngayBatDau" TIMESTAMP(3),
    "ngayKetThuc" TIMESTAMP(3),
    "soNgay" INTEGER,
    "outputChinh" TEXT,
    "trangThai" "TrangThaiGiaiDoan" NOT NULL DEFAULT 'CHUA_BAT_DAU',
    "tienDo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sanPhamId" TEXT NOT NULL,

    CONSTRAINT "giai_doan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buoc" (
    "id" TEXT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "diaDiemHoanThanh" TEXT,
    "soNgayDuKien" INTEGER,
    "duAnId" TEXT NOT NULL,
    "nguoiPhuTrachId" TEXT,
    "ngayBatDau" TIMESTAMP(3),
    "ngayKetThuc" TIMESTAMP(3),
    "trangThai" "TrangThaiBuoc" NOT NULL DEFAULT 'CHUA_LAM',
    "ghiChu" TEXT,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phu_thuoc_buoc" (
    "id" TEXT NOT NULL,
    "buocId" TEXT NOT NULL,
    "phuThuocVaoId" TEXT NOT NULL,
    "loai" "LoaiPhuThuocBuoc" NOT NULL DEFAULT 'FS',
    "soNgayTre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "phu_thuoc_buoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cong_viec" (
    "id" TEXT NOT NULL,
    "mucTieu" TEXT,
    "ten" TEXT NOT NULL,
    "dinhNghiaHoanThanh" TEXT,
    "duAnId" TEXT NOT NULL,
    "sanPhamId" TEXT,
    "nguoiPhuTrachId" TEXT,
    "nguoiPhoiId" TEXT,
    "nguoiChotId" TEXT,
    "trangThai" "TrangThaiCongViec" NOT NULL DEFAULT 'CHUA_LAM',
    "mucUuTien" "MucUuTien" NOT NULL DEFAULT 'TRUNG_BINH',
    "giaiDoanId" TEXT,
    "buocQuyTrinhId" TEXT,
    "ngayBatDau" TIMESTAMP(3),
    "ngayKetThuc" TIMESTAMP(3),
    "soNgayDuKien" INTEGER,
    "soNgayTre" INTEGER NOT NULL DEFAULT 0,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capNhatLuc" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cong_viec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phu_thuoc_cong_viec" (
    "id" TEXT NOT NULL,
    "congViecId" TEXT NOT NULL,
    "phuThuocVaoId" TEXT NOT NULL,

    CONSTRAINT "phu_thuoc_cong_viec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "can_tro" (
    "id" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "moTa" TEXT,
    "mucDo" "MucDoCanTro" NOT NULL DEFAULT 'VUA_PHAI',
    "trangThai" "TrangThaiCanTro" NOT NULL DEFAULT 'MO',
    "duAnId" TEXT NOT NULL,
    "buocBiChanId" TEXT,
    "congViecBiChanId" TEXT,
    "nguoiGapId" TEXT NOT NULL,
    "nguoiXuLyId" TEXT,
    "giaiPhap" TEXT,
    "ngayPhatSinh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ngayXuLy" TIMESTAMP(3),
    "hanXuLy" TIMESTAMP(3),
    "larkMessageId" TEXT,
    "larkChatId" TEXT,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "can_tro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_nhat_can_tro" (
    "id" TEXT NOT NULL,
    "canTroId" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "nguoiCapNhatId" TEXT NOT NULL,
    "doiTrangThai" BOOLEAN NOT NULL DEFAULT false,
    "trangThaiCu" "TrangThaiCanTro",
    "trangThaiMoi" "TrangThaiCanTro",
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cap_nhat_can_tro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_nhat_hang_ngay" (
    "id" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "duAnId" TEXT NOT NULL,
    "ngay" DATE NOT NULL,
    "lamHomNay" TEXT,
    "lamNgayMai" TEXT,
    "canGi" TEXT,
    "coCanTro" BOOLEAN NOT NULL DEFAULT false,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cap_nhat_hang_ngay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binh_luan" (
    "id" TEXT NOT NULL,
    "congViecId" TEXT NOT NULL,
    "nguoiDungId" TEXT NOT NULL,
    "noiDung" TEXT NOT NULL,
    "loai" "LoaiBinhLuan" NOT NULL DEFAULT 'BINH_LUAN',
    "metaData" JSONB,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "binh_luan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhat_ky" (
    "id" TEXT NOT NULL,
    "bangDuLieu" TEXT NOT NULL,
    "bghiId" TEXT NOT NULL,
    "hanhDong" TEXT NOT NULL,
    "nguoiThucHienId" TEXT NOT NULL,
    "duAnId" TEXT,
    "congViecId" TEXT,
    "giaTriCu" JSONB,
    "giaTriMoi" JSONB,
    "taoLuc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhat_ky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_email_key" ON "nguoi_dung"("email");

-- CreateIndex
CREATE UNIQUE INDEX "du_an_ma_key" ON "du_an"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "san_pham_maSp_key" ON "san_pham"("maSp");

-- CreateIndex
CREATE UNIQUE INDEX "phu_thuoc_buoc_buocId_phuThuocVaoId_key" ON "phu_thuoc_buoc"("buocId", "phuThuocVaoId");

-- CreateIndex
CREATE UNIQUE INDEX "phu_thuoc_cong_viec_congViecId_phuThuocVaoId_key" ON "phu_thuoc_cong_viec"("congViecId", "phuThuocVaoId");

-- CreateIndex
CREATE UNIQUE INDEX "cap_nhat_hang_ngay_nguoiDungId_duAnId_ngay_key" ON "cap_nhat_hang_ngay"("nguoiDungId", "duAnId", "ngay");

-- AddForeignKey
ALTER TABLE "du_an" ADD CONSTRAINT "du_an_truongNhomId_fkey" FOREIGN KEY ("truongNhomId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_pham" ADD CONSTRAINT "san_pham_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_pham" ADD CONSTRAINT "san_pham_nguoiPhuTrachId_fkey" FOREIGN KEY ("nguoiPhuTrachId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "giai_doan" ADD CONSTRAINT "giai_doan_sanPhamId_fkey" FOREIGN KEY ("sanPhamId") REFERENCES "san_pham"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buoc" ADD CONSTRAINT "buoc_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buoc" ADD CONSTRAINT "buoc_nguoiPhuTrachId_fkey" FOREIGN KEY ("nguoiPhuTrachId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phu_thuoc_buoc" ADD CONSTRAINT "phu_thuoc_buoc_buocId_fkey" FOREIGN KEY ("buocId") REFERENCES "buoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phu_thuoc_buoc" ADD CONSTRAINT "phu_thuoc_buoc_phuThuocVaoId_fkey" FOREIGN KEY ("phuThuocVaoId") REFERENCES "buoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_sanPhamId_fkey" FOREIGN KEY ("sanPhamId") REFERENCES "san_pham"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_giaiDoanId_fkey" FOREIGN KEY ("giaiDoanId") REFERENCES "giai_doan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_buocQuyTrinhId_fkey" FOREIGN KEY ("buocQuyTrinhId") REFERENCES "buoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_nguoiPhuTrachId_fkey" FOREIGN KEY ("nguoiPhuTrachId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_nguoiPhoiId_fkey" FOREIGN KEY ("nguoiPhoiId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_viec" ADD CONSTRAINT "cong_viec_nguoiChotId_fkey" FOREIGN KEY ("nguoiChotId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phu_thuoc_cong_viec" ADD CONSTRAINT "phu_thuoc_cong_viec_congViecId_fkey" FOREIGN KEY ("congViecId") REFERENCES "cong_viec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phu_thuoc_cong_viec" ADD CONSTRAINT "phu_thuoc_cong_viec_phuThuocVaoId_fkey" FOREIGN KEY ("phuThuocVaoId") REFERENCES "cong_viec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "can_tro" ADD CONSTRAINT "can_tro_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "can_tro" ADD CONSTRAINT "can_tro_buocBiChanId_fkey" FOREIGN KEY ("buocBiChanId") REFERENCES "buoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "can_tro" ADD CONSTRAINT "can_tro_congViecBiChanId_fkey" FOREIGN KEY ("congViecBiChanId") REFERENCES "cong_viec"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "can_tro" ADD CONSTRAINT "can_tro_nguoiGapId_fkey" FOREIGN KEY ("nguoiGapId") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "can_tro" ADD CONSTRAINT "can_tro_nguoiXuLyId_fkey" FOREIGN KEY ("nguoiXuLyId") REFERENCES "nguoi_dung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_nhat_can_tro" ADD CONSTRAINT "cap_nhat_can_tro_canTroId_fkey" FOREIGN KEY ("canTroId") REFERENCES "can_tro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_nhat_can_tro" ADD CONSTRAINT "cap_nhat_can_tro_nguoiCapNhatId_fkey" FOREIGN KEY ("nguoiCapNhatId") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_nhat_hang_ngay" ADD CONSTRAINT "cap_nhat_hang_ngay_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_nhat_hang_ngay" ADD CONSTRAINT "cap_nhat_hang_ngay_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binh_luan" ADD CONSTRAINT "binh_luan_congViecId_fkey" FOREIGN KEY ("congViecId") REFERENCES "cong_viec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binh_luan" ADD CONSTRAINT "binh_luan_nguoiDungId_fkey" FOREIGN KEY ("nguoiDungId") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky" ADD CONSTRAINT "nhat_ky_nguoiThucHienId_fkey" FOREIGN KEY ("nguoiThucHienId") REFERENCES "nguoi_dung"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky" ADD CONSTRAINT "nhat_ky_duAnId_fkey" FOREIGN KEY ("duAnId") REFERENCES "du_an"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhat_ky" ADD CONSTRAINT "nhat_ky_congViecId_fkey" FOREIGN KEY ("congViecId") REFERENCES "cong_viec"("id") ON DELETE SET NULL ON UPDATE CASCADE;
