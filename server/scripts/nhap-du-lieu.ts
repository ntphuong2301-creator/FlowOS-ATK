/**
 * Script nhập dữ liệu ATK từ Excel → PostgreSQL (schema v2)
 * Chạy: pnpm --filter @workspace/server exec tsx scripts/nhap-du-lieu.ts
 *
 * Không hardcode người dùng — đọc từ sheet "🧑🏻‍💻 Thành viên".
 * Quy tắc gán capQuyen:
 *   1. Bộ phận "Điều hành" / "Chiến lược" → QUAN_TRI_VIEN
 *   2. Trạng thái "Deactive" → QUAN_SAT  (trangThai = false)
 *   3. Tên Lark khớp Leader của bất kỳ Dự án nào → TRUONG_NHOM
 *   4. Còn lại → THANH_VIEN
 */

import {
  PrismaClient,
  CapQuyen,
  TrangThaiDuAn,
  KenhSanPham,
  TrangThaiSanPham,
  TrangThaiBuoc,
  TrangThaiCongViec,
  MucDoCanTro,
  TrangThaiCanTro,
} from '@prisma/client';
import { createRequire } from 'module';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx') as typeof import('xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(
  __dirname,
  '../../attached_assets/Quản_lý_dự_án_ra_mắt_sản_phẩm_ATK_(1)_1774540090235.xlsx',
);

// ─── Cấu hình phân quyền theo bộ phận ────────────────────────────────────────
// Chỉ khai báo các bộ phận có role đặc biệt; mặc định là THANH_VIEN

const ROLE_BY_BOPHAN: Record<string, CapQuyen> = {
  'Điều hành': CapQuyen.QUAN_TRI_VIEN,
  'Chiến lược': CapQuyen.QUAN_TRI_VIEN,
};

// ─── Tiện ích ────────────────────────────────────────────────────────────────

function excelDate(serial: unknown): Date | null {
  if (typeof serial !== 'number' || serial <= 0) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return isNaN(d.getTime()) ? null : d;
}

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function firstOf(csv: string): string {
  return csv.split(',')[0].trim();
}

function docSheet(wb: XLSX.WorkBook, keyword: string): string[][] {
  const name = wb.SheetNames.find((s) => s.includes(keyword));
  if (!name) {
    console.warn(`⚠ Không tìm thấy sheet chứa "${keyword}"`);
    return [];
  }
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, defval: '' });
}

/** Chuẩn hoá chuỗi tiếng Việt → slug email (bỏ dấu, thường, thay khoảng trắng bằng dấu chấm) */
function toEmailSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // bỏ dấu
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9\s.]/gi, '')        // bỏ ký tự lạ
    .trim()
    .replace(/\s+/g, '.')
    .toLowerCase();
}

function mapTrangThaiBuoc(v: string): TrangThaiBuoc {
  if (v.includes('Xong') || v.includes('xong') || v.includes('✅'))            return TrangThaiBuoc.XONG;
  if (v.includes('Đang làm') || v.includes('đang làm'))                         return TrangThaiBuoc.DANG_LAM;
  if (v.includes('blocked') || v.includes('Blocked') || v.includes('🔴'))       return TrangThaiBuoc.BI_CHAN;
  return TrangThaiBuoc.CHUA_LAM;
}

function mapTrangThaiCV(v: string): TrangThaiCongViec {
  if (v.includes('Xong') || v.includes('xong') || v.includes('✅'))             return TrangThaiCongViec.XONG;
  if (v.includes('Đang làm') || v.includes('đang làm'))                          return TrangThaiCongViec.DANG_LAM;
  if (v.includes('cản') || v.includes('blocked') || v.includes('Bị blocked'))   return TrangThaiCongViec.BI_CHAN;
  if (v.includes('Hủy') || v.includes('hủy'))                                    return TrangThaiCongViec.DA_HUY;
  return TrangThaiCongViec.CHUA_LAM;
}

function mapMucDo(v: string): MucDoCanTro {
  if (v.includes('Rất nghiêm trọng') || v.includes('🔴')) return MucDoCanTro.RAT_NGHIEM_TRONG;
  if (v.includes('Vừa phải') || v.includes('🟡'))         return MucDoCanTro.VUA_PHAI;
  return MucDoCanTro.NHE;
}

function mapTrangThaiCanTro(v: string): TrangThaiCanTro {
  if (v.includes('Xong') || v.includes('xong') || v.includes('✅')) return TrangThaiCanTro.DA_GIAI_QUYET;
  if (v.includes('Đang xử lý') || v.includes('đang xử lý'))         return TrangThaiCanTro.DANG_XU_LY;
  return TrangThaiCanTro.MO;
}

function mapTrangThaiDuAn(v: string): TrangThaiDuAn {
  const lv = v.toLowerCase();
  if (lv.includes('hoàn thành') || lv.includes('done') || lv.includes('complete')) return TrangThaiDuAn.HOAN_THANH;
  if (lv.includes('tạm dừng') || lv.includes('pause'))                              return TrangThaiDuAn.TAM_DUNG;
  if (lv.includes('lưu trữ') || lv.includes('archive'))                             return TrangThaiDuAn.DA_LUU_TRU;
  return TrangThaiDuAn.DANG_HOAT_DONG;
}

function mapKenh(v: string): KenhSanPham {
  const lv = v.toLowerCase();
  if (lv.includes('truyền thống') || lv.startsWith('tt') || lv === 'truyền thống') return KenhSanPham.TT;
  return KenhSanPham.HT;
}

function mapTrangThaiSanPham(v: string): TrangThaiSanPham {
  if (v.includes('Hoàn thành') || v.includes('Xong') || v.includes('✅')) return TrangThaiSanPham.HOAN_THANH;
  if (v.includes('Hủy'))                                                    return TrangThaiSanPham.HUY;
  if (v.includes('Chưa bắt đầu'))                                          return TrangThaiSanPham.CHUA_BAT_DAU;
  return TrangThaiSanPham.DANG_PHAT_TRIEN;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📖 Đọc file Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`   Sheets: ${wb.SheetNames.join(', ')}\n`);

  // ── 0. Xóa dữ liệu cũ (theo thứ tự FK) ──────────────────────────────────
  console.log('🗑  Xóa dữ liệu cũ...');
  await prisma.nhatKy.deleteMany();
  await prisma.binhLuan.deleteMany();
  await prisma.capNhatHangNgay.deleteMany();
  await prisma.capNhatCanTro.deleteMany();
  await prisma.canTro.deleteMany();
  await prisma.phuThuocCongViec.deleteMany();
  await prisma.congViec.deleteMany();
  await prisma.phuThuocBuoc.deleteMany();
  await prisma.buoc.deleteMany();
  await prisma.giaiDoan.deleteMany();
  await prisma.sanPham.deleteMany();
  await prisma.duAn.deleteMany();
  await prisma.nguoiDung.deleteMany();
  console.log('   ✅ Xong\n');

  // ── 1. Thu thập Leader lark-names từ sheet Dự án ─────────────────────────
  // Dùng để xác định TRUONG_NHOM, không hardcode danh sách người
  const rowsDA_raw = docSheet(wb, 'Dự án');
  // [0]Dự án [1]Nhóm [2]Leader [3]Member [4]Mục tiêu [5]Trạng thái
  const leaderLarkNames = new Set<string>();
  for (let i = 1; i < rowsDA_raw.length; i++) {
    const leader = str(rowsDA_raw[i][2]);
    if (leader) leaderLarkNames.add(leader);
  }

  // ── 2. Seed thành viên từ sheet 🧑🏻‍💻 Thành viên ───────────────────────────
  // [0]Tên  [1]Tài khoản lark  [2]Bộ Phận  [3]Trạng thái
  console.log('👥 Seed thành viên...');
  const rowsTV = docSheet(wb, 'Thành viên');

  const HASH_DEFAULT = await bcrypt.hash('Atk@2026', 10);
  const HASH_ADMIN   = await bcrypt.hash('admin123', 10);

  // Admin hệ thống (không có trong sheet)
  const admin = await prisma.nguoiDung.create({
    data: {
      ten: 'Admin ATK',
      email: 'admin@atk.com',
      matKhau: HASH_ADMIN,
      capQuyen: CapQuyen.QUAN_TRI_VIEN,
    },
  });

  // Map nhiều khóa → id để timND() hoạt động chính xác
  const nguoiDungMap = new Map<string, string>();
  nguoiDungMap.set('Admin ATK', admin.id);
  nguoiDungMap.set('admin@atk.com', admin.id);

  // Theo dõi email đã dùng để tránh trùng
  const usedEmails = new Set<string>(['admin@atk.com']);

  let demND = 0;

  for (let i = 1; i < rowsTV.length; i++) {
    const row     = rowsTV[i];
    const ten     = str(row[0]); // Tên ngắn (Phương, Thúy, ...)
    const larkTen = str(row[1]); // Tên đầy đủ Lark (Nguyễn Thành Phương, ...)
    const boPhan  = str(row[2]); // Bộ phận
    const status  = str(row[3]); // Trạng thái

    if (!ten) continue;

    const active = status.toLowerCase() !== 'deactive';

    // --- Gán capQuyen theo quy tắc (không hardcode cá nhân) ---
    let capQuyen: CapQuyen;
    if (!active) {
      // Nguyên tắc 1: Deactive → quan sát viên
      capQuyen = CapQuyen.QUAN_SAT;
    } else if (ROLE_BY_BOPHAN[boPhan]) {
      // Nguyên tắc 2: Bộ phận đặc biệt → role từ cấu hình
      capQuyen = ROLE_BY_BOPHAN[boPhan];
    } else if (leaderLarkNames.has(larkTen)) {
      // Nguyên tắc 3: Tên Lark là Leader của dự án → trưởng nhóm
      capQuyen = CapQuyen.TRUONG_NHOM;
    } else {
      capQuyen = CapQuyen.THANH_VIEN;
    }

    // --- Tạo email từ tên Lark (duy nhất, tránh trùng Thúy/Thùy) ---
    let emailBase = toEmailSlug(larkTen || ten);
    let email = `${emailBase}@atk.com`;
    let suffix = 2;
    while (usedEmails.has(email)) {
      email = `${emailBase}${suffix}@atk.com`;
      suffix++;
    }
    usedEmails.add(email);

    const nd = await prisma.nguoiDung.create({
      data: {
        ten,
        email,
        matKhau: HASH_DEFAULT,
        capQuyen,
        larkUserId: larkTen || null,
        trangThai: active,
      },
    });

    // Đăng ký nhiều key để timND() nhận dạng
    nguoiDungMap.set(ten, nd.id);          // "Thúy"
    nguoiDungMap.set(larkTen, nd.id);      // "Lưu Thúy"
    nguoiDungMap.set(email, nd.id);        // "luu.thuy@atk.com"
    // Alias theo từ cuối của tên Lark (họ tên Việt: từ cuối là tên)
    const firstName = larkTen.split(' ').pop();
    if (firstName && firstName !== ten) nguoiDungMap.set(firstName, nd.id);

    demND++;
  }

  console.log(`   → ${demND} thành viên + 1 admin\n`);

  /** Tìm nguoiDungId theo tên (khớp chính xác trước, rồi partial) */
  function timND(ten: string): string | null {
    if (!ten) return null;
    const t = ten.trim();
    if (nguoiDungMap.has(t)) return nguoiDungMap.get(t)!;
    for (const [k, v] of nguoiDungMap) {
      if (!k) continue;
      if (k.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(k.toLowerCase())) return v;
    }
    return null;
  }

  // ── 3. Nhập Dự án (sheet 🚩Dự án) ──────────────────────────────────────
  // [0]Dự án  [1]Nhóm  [2]Leader  [3]Member  [4]Mục tiêu  [5]Trạng thái
  console.log('📁 Nhập dự án...');

  const duAnMap = new Map<string, string>();
  let demDuAn = 0;

  for (let i = 1; i < rowsDA_raw.length; i++) {
    const row      = rowsDA_raw[i];
    const ma       = str(row[0]); // "DA1,2 RD"
    const nhom     = str(row[1]); // "DA1,2- RnD Product"
    const leader   = str(row[2]);
    const mucTieu  = str(row[4]);
    const tthai    = str(row[5]);

    if (!ma || !nhom) continue;

    const truongNhomId = timND(firstOf(leader)) ?? admin.id;

    const da = await prisma.duAn.create({
      data: {
        ma,
        ten: nhom,
        moTa: mucTieu || null,
        trangThai: mapTrangThaiDuAn(tthai),
        truongNhomId,
      },
    });

    duAnMap.set(ma, da.id);
    duAnMap.set(nhom, da.id);
    // Alias các mã thành phần: "DA1,2 RD" → "DA1", "DA2"
    ma.split(',').forEach((part) => {
      const p = part.trim();
      if (p) duAnMap.set(p, da.id);
    });
    demDuAn++;
  }

  // DuAn container cho Sprint toàn hệ thống
  if (!duAnMap.has('SOS')) {
    const dasos = await prisma.duAn.create({
      data: { ma: 'SOS', ten: 'SOS Sản Phẩm', truongNhomId: admin.id },
    });
    duAnMap.set('SOS', dasos.id);
    duAnMap.set('SOS Sản Phẩm', dasos.id);
    demDuAn++;
  }

  console.log(`   → ${demDuAn} dự án\n`);

  function timDA(ten: string): string | null {
    if (!ten) return null;
    const t = ten.trim();
    if (duAnMap.has(t)) return duAnMap.get(t)!;
    for (const [k, v] of duAnMap) {
      if (!k) continue;
      if (t.startsWith(k) || k.startsWith(t)) return v;
      if (t.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(t.toLowerCase())) return v;
    }
    return null;
  }

  // ── 4. Nhập Sản phẩm (sheet 🍶Sản phẩm) ─────────────────────────────────
  // [0]Tên sản phẩm 1  [1]Mã sản phẩm  [2]Kênh  [3]Hương vị
  // [4]Dung tích  [5]pH +-0.5  [6]Ngày launch  [7]Trạng thái tổng
  console.log('🍶 Nhập sản phẩm...');

  // Build map SanPham → DuAn từ cột 🍶 Sản phẩm trong sheet Bước
  const rowsBuocRaw = docSheet(wb, 'Các Bước');
  const spDuAnMap   = new Map<string, string>();
  for (let i = 1; i < rowsBuocRaw.length; i++) {
    const tenDA  = str(rowsBuocRaw[i][1]);
    const spList = str(rowsBuocRaw[i][10]);
    if (!spList || !tenDA) continue;
    const daId = timDA(tenDA);
    if (!daId) continue;
    spList.split(',').forEach((sp) => {
      const s = sp.trim();
      if (s && !spDuAnMap.has(s)) spDuAnMap.set(s, daId);
    });
  }

  const rowsSP    = docSheet(wb, 'Sản phẩm');
  const sanPhamMap = new Map<string, string>();
  let demSanPham = 0;

  for (let i = 1; i < rowsSP.length; i++) {
    const row       = rowsSP[i];
    const ten      = str(row[0]); // "Tên sản phẩm 1"
    const maSp     = str(row[1]); // "Mã sản phẩm"
    const kenh     = str(row[2]);
    const huongVi  = str(row[3]);
    const dungTich = str(row[4]);
    const ph       = str(row[5]);
    const launch   = row[6];
    // ⚠ KHÔNG import: % tiến độ (row[7] trở đi), trạng thái tổng, cản trở
    // Backend tự tính realtime từ trạng thái Buoc

    if (!ten || !maSp) continue;
    if (!kenh || kenh.toLowerCase() === 'trang thiết bị') continue;

    let duAnId = spDuAnMap.get(ten) ?? spDuAnMap.get(maSp);
    if (!duAnId) {
      const maUpper = maSp.toUpperCase();
      if (maUpper.startsWith('HT') || /^TT[1-5]/.test(maUpper)) {
        duAnId = timDA('DA1') ?? undefined;
      } else if (maUpper.startsWith('NV') || ten.includes('Nắp')) {
        duAnId = timDA('DA3') ?? undefined;
      }
    }
    if (!duAnId) duAnId = duAnMap.get('SOS')!;

    const sp = await prisma.sanPham.create({
      data: {
        maSp,
        ten,
        kenh: mapKenh(kenh),
        huongVi: huongVi || null,
        dungTichMl: parseInt(dungTich) || null,
        phLevel: parseFloat(ph) || null,
        ngayLaunch: excelDate(launch),
        // trangThai: KHÔNG import — để default CHUA_BAT_DAU, backend tính realtime
        duAnId,
      },
    });

    sanPhamMap.set(ten, sp.id);
    sanPhamMap.set(maSp, sp.id);
    demSanPham++;
  }

  // SanPham container toàn dự án (chứa Sprint)
  const spSprint = await prisma.sanPham.create({
    data: {
      maSp: 'SOS-SPRINT',
      ten: 'SOS Sprint (Global)',
      kenh: KenhSanPham.HT,
      duAnId: duAnMap.get('SOS')!,
    },
  });
  sanPhamMap.set('SOS-SPRINT', spSprint.id);

  console.log(`   → ${demSanPham} sản phẩm\n`);

  // ── 5. Nhập GiaiDoan (sheet ⏰Sprint) ───────────────────────────────────
  // [0]Tên sprint  [1]Ngày bắt đầu  [2]Ngày kết thúc  [3]Số ngày
  // [4]Output chính  ...  [8]Tiến độ sprint
  console.log('⏰ Nhập sprint / giai đoạn...');
  const rowsSprint = docSheet(wb, 'Sprint');
  const giaiDoanMap = new Map<string, string>();
  let demGiaiDoan = 0;

  for (let i = 1; i < rowsSprint.length; i++) {
    const row       = rowsSprint[i];
    const ten    = str(row[0]);
    const batDau = excelDate(row[1]);
    const soNgay = parseInt(str(row[3])) || null;
    const output = str(row[4]);
    // ⚠ KHÔNG import % tiến độ từ Excel — backend tự tính realtime

    let ketThuc = excelDate(row[2]);
    if (!ketThuc && batDau && soNgay) {
      ketThuc = new Date(batDau.getTime() + soNgay * 86400 * 1000);
    }
    if (!ten) continue;

    const gd = await prisma.giaiDoan.create({
      data: {
        ten,
        ngayBatDau: batDau,
        ngayKetThuc: ketThuc,
        soNgay,
        outputChinh: output || null,
        // tienDo: KHÔNG import — backend tính từ Buoc
        sanPhamId: spSprint.id,
      },
    });

    giaiDoanMap.set(ten, gd.id);
    giaiDoanMap.set(ten.toLowerCase(), gd.id);
    demGiaiDoan++;
  }

  console.log(`   → ${demGiaiDoan} sprint\n`);

  function timGD(sprintStr: string): string | null {
    if (!sprintStr) return null;
    const first = firstOf(sprintStr).trim();
    return giaiDoanMap.get(first) ?? giaiDoanMap.get(first.toLowerCase()) ?? null;
  }

  // ── 6. Nhập Bước (sheet 👣 Các Bước) ────────────────────────────────────
  // [0]Tên bước  [1]Dự án  [2]Định nghĩa hoàn thành  [3]Số ngày dự kiến
  // [4]Phụ thuộc vào bước  [5]Incharge  [6]Người duyệt  [7]Bắt đầu  [8]Kết thúc  [9]Trạng thái
  console.log('👣 Nhập bước...');

  const buocMap      = new Map<string, string>();
  const buocPhuThuoc: Array<{ buocId: string; phuThuocTen: string }> = [];
  let demBuoc = 0;

  for (let i = 1; i < rowsBuocRaw.length; i++) {
    const row       = rowsBuocRaw[i];
    const ten       = str(row[0]);
    const tenDA     = str(row[1]);
    const dinhNghia = str(row[2]);
    const soNgay    = parseInt(str(row[3])) || null;
    const phuThuoc  = str(row[4]);
    const incharge  = str(row[5]);
    const batDau    = excelDate(row[7]);
    const ketThuc   = excelDate(row[8]);
    const tthai     = str(row[9]);

    if (!ten || !tenDA) continue;

    const duAnId = timDA(tenDA);
    if (!duAnId) continue;

    // Mã bước: ký tự đầu của tên (VD: "NAP1 Có thông số..." → "NAP1")
    const maMatch = ten.match(/^([A-Z]+\d+[A-Z]*\d*)/);
    const ma = maMatch ? maMatch[1] : ten.substring(0, 10);

    const nguoiPhuTrachId = timND(firstOf(incharge));

    const buoc = await prisma.buoc.create({
      data: {
        ma,
        ten,
        diaDiemHoanThanh: dinhNghia || null,
        soNgayDuKien: soNgay,
        duAnId,
        nguoiPhuTrachId,
        ngayBatDau: batDau,
        ngayKetThuc: ketThuc,
        trangThai: mapTrangThaiBuoc(tthai),
      },
    });

    buocMap.set(ten, buoc.id);
    buocMap.set(ma, buoc.id);

    if (phuThuoc) {
      phuThuoc.split(',').forEach((pt) => {
        const p = pt.trim();
        if (p) buocPhuThuoc.push({ buocId: buoc.id, phuThuocTen: p });
      });
    }
    demBuoc++;
  }

  // PhuThuocBuoc (tạo sau khi đã insert hết bước)
  let demPhuThuocBuoc = 0;
  for (const { buocId, phuThuocTen } of buocPhuThuoc) {
    const phuThuocId =
      buocMap.get(phuThuocTen) ??
      (() => {
        const prefix = phuThuocTen.substring(0, 6).toLowerCase();
        for (const [k, v] of buocMap) {
          if (k.toLowerCase().startsWith(prefix)) return v;
        }
        return null;
      })();

    if (!phuThuocId || phuThuocId === buocId) continue;

    await prisma.phuThuocBuoc
      .upsert({
        where: { buocId_phuThuocVaoId: { buocId, phuThuocVaoId: phuThuocId } },
        create: { buocId, phuThuocVaoId: phuThuocId },
        update: {},
      })
      .catch(() => null);
    demPhuThuocBuoc++;
  }

  console.log(`   → ${demBuoc} bước, ${demPhuThuocBuoc} phụ thuộc\n`);

  function timBuoc(tenBuoc: string): string | null {
    if (!tenBuoc) return null;
    const t = tenBuoc.trim();
    if (buocMap.has(t)) return buocMap.get(t)!;
    const prefix = t.substring(0, 6).toLowerCase();
    for (const [k, v] of buocMap) {
      if (k.toLowerCase().startsWith(prefix)) return v;
    }
    return null;
  }

  // ── 7. Nhập Công việc (sheet ✅Công việc) ────────────────────────────────
  // [0]Mục tiêu  [1]Công việc  [2]Định nghĩa hoàn thành  [3]Dự án
  // [4]Sản phẩm  [5]Incharge  [6]Phối hợp  [7]Trạng thái  [8]Sprint
  // [9]Ngày bắt đầu  [10]Ngày kết thúc  [12]Số ngày  [13]Bước quy trình
  // [14]Số ngày trễ  [18]Người chốt
  console.log('✅ Nhập công việc...');
  const rowsCV       = docSheet(wb, 'Công việc');
  const fallbackDuAnId = [...duAnMap.values()][0];
  let demCV = 0;

  for (let i = 1; i < rowsCV.length; i++) {
    const row       = rowsCV[i];
    const mucTieu   = str(row[0]);
    const ten       = str(row[1]);
    const dinhNghia = str(row[2]);
    const tenDA     = str(row[3]);
    const tenSP     = str(row[4]);
    const incharge  = str(row[5]);
    const phoi      = str(row[6]);
    const tthai     = str(row[7]);
    const sprint    = str(row[8]);
    const batDau    = excelDate(row[9]);
    const ketThuc   = excelDate(row[10]);
    const soNgay    = parseInt(str(row[12])) || null;
    const tenBuoc   = str(row[13]);
    const soNgayTre = parseInt(str(row[14])) || 0;
    const tenChot   = str(row[18]);

    if (!ten) continue;
    // Bỏ dòng nhãn sprint và dòng số thuần tuý
    if (/^Sprint\s*\d+$/i.test(ten) || /^\d+(\.\d+)?%?$/.test(ten)) continue;

    await prisma.congViec.create({
      data: {
        mucTieu: mucTieu || null,
        ten,
        dinhNghiaHoanThanh: dinhNghia || null,
        duAnId:          timDA(firstOf(tenDA)) ?? fallbackDuAnId,
        sanPhamId:       sanPhamMap.get(firstOf(tenSP)) ?? null,
        nguoiPhuTrachId: timND(firstOf(incharge)),
        nguoiPhoiId:     timND(firstOf(phoi)),
        nguoiChotId:     timND(tenChot),
        trangThai:       mapTrangThaiCV(tthai),
        giaiDoanId:      timGD(sprint),
        buocQuyTrinhId:  timBuoc(tenBuoc),
        ngayBatDau:      batDau,
        ngayKetThuc:     ketThuc,
        soNgayDuKien:    soNgay,
        soNgayTre,
      },
    });
    demCV++;
  }

  console.log(`   → ${demCV} công việc\n`);

  // ── 8. Nhập Cản trở (sheet 🔴Cản trở) ────────────────────────────────
  // [0]Hạng mục  [1]Link  [2]Dự án  [3]Bước bị block  [4]Sản phẩm
  // [5]Ai gặp phải  [6]Ai chịu trách nhiệm  [7]Mức độ  [8]Trạng thái
  // [9]Ngày phát sinh  [10]Ngày xử lý  [11]Deadline xử lý  [12]Thông tin thêm
  console.log('🔴 Nhập cản trở...');
  const rowsCT = docSheet(wb, 'Cản trở');
  let demCT = 0;

  for (let i = 1; i < rowsCT.length; i++) {
    const row      = rowsCT[i];
    const ten      = str(row[0]);
    const tenDA    = str(row[2]);
    const buocBlk  = str(row[3]);
    const aiGap    = str(row[5]);
    const aiXuLy   = str(row[6]);
    const mucDo    = str(row[7]);
    const tthai    = str(row[8]);
    const ngayPS   = excelDate(row[9]);
    const ngayXL   = excelDate(row[10]);
    const hanXL    = excelDate(row[11]);
    const giaiPhap = str(row[12]);

    if (!ten) continue;

    await prisma.canTro.create({
      data: {
        ten,
        giaiPhap:    giaiPhap || null,
        mucDo:       mapMucDo(mucDo),
        trangThai:   mapTrangThaiCanTro(tthai),
        duAnId:      timDA(firstOf(tenDA)) ?? fallbackDuAnId,
        buocBiChanId: timBuoc(firstOf(buocBlk)),
        nguoiGapId:  timND(firstOf(aiGap)) ?? admin.id,
        nguoiXuLyId: timND(firstOf(aiXuLy)),
        ngayPhatSinh: ngayPS ?? new Date(),
        ngayXuLy:    ngayXL,
        hanXuLy:     hanXL,
      },
    });
    demCT++;
  }

  console.log(`   → ${demCT} cản trở\n`);

  // ── Tổng kết ─────────────────────────────────────────────────────────────
  const sep = '═'.repeat(60);
  console.log(sep);
  console.log(`Đã nhập ${demDuAn} dự án, ${demBuoc} bước, ${demCV} công việc, ${demCT} cản trở`);
  console.log(`Người dùng: 1 admin + ${demND} thành viên từ sheet`);
  console.log(sep);
  console.log('👤 admin@atk.com   / admin123');
  console.log('👥 <lark-slug>@atk.com   / Atk@2026  (xem console để biết email)');
  console.log(sep);

  // ── Xác nhận logic tính % ────────────────────────────────────────────────
  console.log('\n📊 Tiến độ % sẽ được tính REALTIME từ trạng thái Buoc (không lưu vào DB):');
  console.log('   GET /api/san-pham                → danh sách 13 SKU + % tổng');
  console.log('   GET /api/san-pham/:id/tien-do    → chi tiết RD/NAP/BaoBi/PhapChe/SXCN');
  console.log('   GET /api/san-pham/tong-quan      → CEO dashboard summary');
  console.log('\n   Trọng số: R&D 30% | Nắp 25% | Bao bì 20% | Pháp chế 15% | SXCN 10%');
  console.log(sep);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
