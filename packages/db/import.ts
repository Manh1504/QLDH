/**
 * Import data cũ (10 xlsx export từ Google Sheets) vào Postgres.
 * Chạy:  npx tsx import.ts "C:\path\to\xlsx-dir"
 * Yêu cầu: DATABASE_URL, DB đã migrate. Idempotent (upsert theo mã).
 *
 * Map trạng thái: Mới->MOI, Đang soạn->DANG_SOAN, Đã soạn->XUAT_KHO,
 * Nợ đơn->HOA_DON, Xóa->HUY/REJECTED. Dòng NhapTay không mã kho -> OrderItem.manual.
 */
import * as XLSX from 'xlsx';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const stats: Record<string, number> = {};
const skips: string[] = [];
function ok(k: string, n = 1) { stats[k] = (stats[k] || 0) + n; }
function skip(msg: string) { skips.push(msg); }

function sheet(wb: XLSX.WorkBook, name: string): any[] {
  const ws = wb.Sheets[name];
  if (!ws) { skip(`missing sheet ${name}`); return []; }
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  return rows.filter((r) => Object.values(r).some((v) => v !== null && String(v).trim() !== ''));
}

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
function str(v: any): string { return v === null || v === undefined ? '' : String(v).trim(); }
function dt(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') { // excel serial
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function ym(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const ORDER_STATUS: Record<string, any> = { 'Mới': 'MOI', 'Đang soạn': 'DANG_SOAN', 'Đã soạn': 'XUAT_KHO', 'Nợ đơn': 'HOA_DON', 'Xóa': 'HUY' };
const RETURN_STATUS: Record<string, any> = { 'Mới': 'REQUESTED', 'Đã duyệt': 'APPROVED', 'Xóa': 'REJECTED' };

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Thiếu đường dẫn thư mục xlsx');
  const open = (f: string) => XLSX.readFile(`${dir}/${f}`);

  // ---- 1. SYSTEM: tài khoản (hash lại mật khẩu) ----
  {
    const wb = open('01_DATA_SYSTEM.xlsx');
    for (const r of sheet(wb, 'tbl_TaiKhoan')) {
      const username = str(r['User']);
      if (!username) continue;
      const roles = str(r['Role']).split(/[,/]/).map((s) => s.trim()).filter(Boolean);
      await prisma.user.upsert({
        where: { username },
        update: { name: str(r['TenNhanVien']) || username, phone: str(r['SDT']) || null, roles: roles.length ? roles : ['MEMBER'] },
        create: { username, passwordHash: await argon2.hash(str(r['Pass']) || username), name: str(r['TenNhanVien']) || username, phone: str(r['SDT']) || null, roles: roles.length ? roles : ['MEMBER'] },
      });
      ok('users');
    }
  }

  // ---- 2. SALES: khách hàng ----
  const custId = new Map<string, string>();
  {
    const wb = open('02_DATA_SALES_CRM.xlsx');
    for (const r of sheet(wb, 'tbl_KhachHang')) {
      const code = str(r['MaKhachHang']);
      if (!code) continue;
      const c = await prisma.customer.upsert({
        where: { code },
        update: { name: str(r['TenKhachHang']) || code },
        create: { code, name: str(r['TenKhachHang']) || code, phone: str(r['SDT']) || null, address: str(r['DiaChi']) || null, carrierName: str(r['ChanhXe']) || null, carrierPhone: str(r['SDTChanhXe']) || null, group: str(r['NhomKhach']) || null, region: str(r['KhuVuc']) || null },
      });
      custId.set(code, c.id);
      ok('customers');
    }
  }

  // ---- 3. SALES: đơn hàng ----
  const orderId = new Map<string, string>();
  const skippedOrders = new Set<string>();
  {
    const wb = open('02_DATA_SALES_CRM.xlsx');
    const sysUser = await prisma.user.findFirst();
    for (const r of sheet(wb, 'tbl_DonHang')) {
      const code = str(r['MaHoaDon']);
      if (!code) continue;
      let cId = custId.get(str(r['MaKH']));
      if (!cId && str(r['MaKH'])) { // KH vãng lai / mã tạm không có trong danh bạ -> tạo placeholder
        const c = await prisma.customer.create({ data: { code: str(r['MaKH']), name: str(r['TenKhach']) || str(r['MaKH']) } });
        custId.set(c.code, c.id); cId = c.id;
        ok('customers_placeholder');
      }
      if (!cId) { skip(`DonHang ${code} thiếu KH ${str(r['MaKH'])}`); continue; }
      const existed = await prisma.order.findUnique({ where: { code }, select: { id: true } });
      if (existed) { orderId.set(code, existed.id); skippedOrders.add(code); ok('orders_skip'); continue; } // chạy lại: bỏ qua
      const o = await prisma.order.create({
        data: {
          code, customerId: cId, type: str(r['LoaiDon']) || 'BAN_LE',
          status: ORDER_STATUS[str(r['TrangThai'])] || 'MOI',
          shipDate: dt(r['NgayGiao']), note: [str(r['GhiChuKhach']), str(r['GhiChuNV'])].filter(Boolean).join(' | ') || null,
          total: num(r['TongTien']), paid: num(r['DaThanhToan']),
          createdAt: dt(r['NgayTao']) || undefined,
          history: { create: { toStatus: ORDER_STATUS[str(r['TrangThai'])] || 'MOI', actorId: sysUser!.id, note: 'Import từ Sheets' } },
        },
      });
      orderId.set(code, o.id);
      ok('orders');
      // Ảnh Zalo đính trong AnhZaloJson
      try {
        const raw = str(r['AnhZaloJson']);
        if (raw.startsWith('[')) {
          const urls: string[] = JSON.parse(raw);
          for (const url of urls.slice(0, 20)) {
            const dup = await prisma.orderImage.findFirst({ where: { orderId: o.id, url: String(url) } });
            if (dup) { ok('orderImages_skip'); continue; }
            await prisma.orderImage.create({ data: { orderId: o.id, url: String(url), uploadedBy: 'import' } });
            ok('orderImages');
          }
        }
      } catch { /* bỏ qua json hỏng */ }
    }
    // Chi tiết đơn: có MaHangNoiBo -> link variant (tạo placeholder), không có -> dòng tay
    for (const r of sheet(wb, 'tbl_ChiTietDonHang')) {
      if (skippedOrders.has(str(r['MaHoaDon']))) continue;
      const oId = orderId.get(str(r['MaHoaDon']));
      if (!oId) { skip(`ChiTiet thiếu đơn ${str(r['MaHoaDon'])}`); continue; }
      const maNoiBo = str(r['MaHangNoiBo']);
      let variantId: string | null = null;
      if (maNoiBo) {
        let v = await prisma.productVariant.findUnique({ where: { internalCode: maNoiBo } });
        if (!v) {
          const p = await prisma.product.upsert({ where: { code: str(r['MaBanHang']) || maNoiBo }, update: {}, create: { code: str(r['MaBanHang']) || maNoiBo, name: str(r['TenSP']) || maNoiBo } });
          v = await prisma.productVariant.create({ data: { internalCode: maNoiBo, salesCode: str(r['MaBanHang']) || null, productId: p.id, color: str(r['MauChuan'] || r['Mau']) || '-', size: str(r['Size']) || '-' } });
        }
        variantId = v.id;
      }
      await prisma.orderItem.create({
        data: { orderId: oId, variantId, productName: variantId ? null : str(r['TenSP']) || null, color: variantId ? null : str(r['MauChuan']) || null, size: variantId ? null : str(r['Size']) || null, qty: Math.trunc(num(r['SoLuong'])), unitPrice: num(r['DonGia']), note: str(r['GhiChu']) || null },
      });
      ok('orderItems');
    }
    // Ảnh Zalo rời
    for (const r of sheet(wb, 'tbl_DonHang_AnhZalo')) {
      if (skippedOrders.has(str(r['MaHoaDon']))) continue;
      const oId = orderId.get(str(r['MaHoaDon']));
      if (!oId || !str(r['LinkAnh'])) continue;
      const at = dt(r['ThoiGian']) || undefined;
      const dup = await prisma.orderImage.findFirst({ where: { orderId: oId, url: str(r['LinkAnh']), createdAt: at } });
      if (dup) { ok('orderImages_skip'); continue; }
      await prisma.orderImage.create({ data: { orderId: oId, url: str(r['LinkAnh']), uploadedBy: str(r['NguoiUpload']) || 'import', createdAt: at } });
      ok('orderImages');
    }
    // Lịch sử trạng thái
    const sysUser2 = await prisma.user.findFirst();
    for (const r of sheet(wb, 'tbl_LichSuTrangThaiDon')) {
      if (skippedOrders.has(str(r['MaHoaDon']))) continue;
      const oId = orderId.get(str(r['MaHoaDon']));
      const to = ORDER_STATUS[str(r['TrangThaiMoi'])];
      if (!oId || !to) continue;
      const at = dt(r['ThoiGian']) || undefined;
      const dup = await prisma.orderStatusHistory.findFirst({ where: { orderId: oId, toStatus: to, createdAt: at } });
      if (dup) { ok('orderHistory_skip'); continue; }
      await prisma.orderStatusHistory.create({ data: { orderId: oId, fromStatus: ORDER_STATUS[str(r['TrangThaiCu'])] || null, toStatus: to, actorId: sysUser2!.id, note: str(r['GhiChu']) || null, createdAt: at } });
      ok('orderHistory');
    }
    // Hàng trả
    for (const r of sheet(wb, 'tbl_HangTra')) {
      const cId = custId.get(str(r['MaKH']));
      if (!cId) { skip(`HangTra ${str(r['MaPhieuTra'])} thiếu KH`); continue; }
      await prisma.return.upsert({
        where: { code: str(r['MaPhieuTra']) },
        update: {},
        create: { code: str(r['MaPhieuTra']), orderId: orderId.get(str(r['MaHoaDonGoc'])) || null, customerId: cId, status: RETURN_STATUS[str(r['TrangThai'])] || 'REQUESTED', note: str(r['GhiChu']) || null, createdAt: dt(r['NgayTra']) || undefined },
      });
      ok('returns');
    }
  }

  // ---- 4. TAI_CHINH: thu tiền khách ----
  {
    if ((await prisma.customerPayment.count()) > 0) { ok('payments_skip'); }
    else {
    const wb = open('06_DATA_TAI_CHINH_CONG_NO.xlsx');
    for (const r of sheet(wb, 'tbl_ThanhToanKhach')) {
      const cId = custId.get(str(r['MaKH']));
      if (!cId) { skip(`ThanhToan thiếu KH ${str(r['MaKH'])}`); continue; }
      const at = dt(r['NgayThanhToan']) || undefined;
      const oRef = orderId.get(str(r['MaHoaDon'])) || null;
      // MaHoaDon gộp (VD "HD1 + HD2") không link được -> giữ vào note để khỏi lẫn các lần thu trùng số tiền
      const note = [str(r['GhiChu']) || null, !oRef && str(r['MaHoaDon']) ? `HD: ${str(r['MaHoaDon'])}` : null].filter(Boolean).join(' | ') || null;
      const dup = await prisma.customerPayment.findFirst({ where: { customerId: cId, orderId: oRef, amount: num(r['SoTien']), method: str(r['HinhThuc']) || null, note, createdAt: at } });
      if (dup) { ok('payments_skip'); continue; }
      await prisma.customerPayment.create({ data: { customerId: cId, orderId: oRef, amount: num(r['SoTien']), method: str(r['HinhThuc']) || null, note, createdAt: at } });
      ok('payments');
    }
    }
  }

  // ---- 5. NHAN_SU ----
  const empId = new Map<string, string>();
  {
    const wb = open('07_DATA_NHAN_SU.xlsx');
    for (const r of sheet(wb, 'tbl_NhanVien')) {
      const name = str(r['TenNhanVien']);
      if (!name) continue;
      const e = await prisma.employee.upsert({ where: { name }, update: {}, create: { name, phone: str(r['SDT']) || null, position: str(r['ChucVu']) || null, dailyWage: num(r['LuongNgay']) || null, status: str(r['TrangThai']) || 'ACTIVE' } });
      empId.set(name, e.id);
      ok('employees');
    }
    for (const r of sheet(wb, 'tbl_ChamCong')) {
      const eId = empId.get(str(r['TenNhanVien']));
      const d = dt(r['Ngay']);
      if (!eId || !d) continue;
      await prisma.attendance.upsert({ where: { employeeId_date: { employeeId: eId, date: d } }, update: { shifts: num(r['Cong']), overtimeH: num(r['TangCaGio']) }, create: { employeeId: eId, date: d, shifts: num(r['Cong']), overtimeH: num(r['TangCaGio']) } });
      ok('attendance');
    }
    for (const r of sheet(wb, 'tbl_UngLuong')) {
      let eId = empId.get(str(r['TenNhanVien']));
      if (!eId && str(r['TenNhanVien'])) { // team/tổ chưa có -> tạo NV
        const e = await prisma.employee.create({ data: { name: str(r['TenNhanVien']) } });
        empId.set(e.name, e.id); eId = e.id;
      }
      if (!eId) continue;
      const at = dt(r['NgayUng']) || undefined;
      const dup = await prisma.salaryAdvance.findFirst({ where: { employeeId: eId, amount: num(r['SoTien']), createdAt: at } });
      if (dup) { ok('advances_skip'); continue; }
      await prisma.salaryAdvance.create({ data: { employeeId: eId, amount: num(r['SoTien']), note: str(r['GhiChu']) || null, createdAt: at } });
      ok('advances');
    }
  }

  // ---- 6. RAP: nhà may / thợ cắt / rập ----
  const facId = new Map<string, string>();
  {
    const wb = open('04_DATA_SAN_XUAT_RAP.xlsx');
    for (const r of sheet(wb, 'tbl_NhaMay')) {
      const name = str(r['TenNhaMay']);
      if (!name) continue;
      const code = str(r['MaNhaMay']) || `NM-${name}`;
      const f = await prisma.factory.upsert({ where: { name }, update: {}, create: { code, name, status: 'ACTIVE' } });
      facId.set(name, f.id);
      ok('factories');
    }
    for (const r of sheet(wb, 'tbl_NhaMay_ChotDon')) {
      let fId = facId.get(str(r['TenNhaMay']));
      if (!fId && str(r['TenNhaMay'])) {
        const f = await prisma.factory.create({ data: { code: `NM-${str(r['TenNhaMay'])}`, name: str(r['TenNhaMay']) } });
        facId.set(f.name, f.id); fId = f.id;
      }
      if (!fId) continue;
      const st = str(r['TrangThai']) === 'Đã thanh toán' ? 'DONE' : 'PARTIAL';
      await prisma.factorySettlement.upsert({ where: { code: str(r['MaChot']) }, update: {}, create: { factoryId: fId, code: str(r['MaChot']), amount: num(r['ThanhTien']), paid: num(r['DaThanhToan']), status: st as any, note: str(r['GhiChu']) || null, createdAt: dt(r['NgayChot']) || undefined } });
      ok('settlements');
    }
    for (const r of sheet(wb, 'tbl_NhaMay_ThanhToan')) {
      const fId = facId.get(str(r['TenNhaMay']));
      if (!fId) continue;
      const at = dt(r['NgayThanhToan']) || undefined;
      const dup = await prisma.factoryPayment.findFirst({ where: { factoryId: fId, amount: num(r['SoTien']), createdAt: at } });
      if (dup) { ok('factoryPayments_skip'); continue; }
      await prisma.factoryPayment.create({ data: { factoryId: fId, amount: num(r['SoTien']), method: str(r['HinhThuc']) || null, note: str(r['GhiChu']) || null, createdAt: at } });
      ok('factoryPayments');
    }
    const cutId = new Map<string, string>();
    for (const r of sheet(wb, 'tbl_DoiCat')) {
      const name = str(r['TenDoiCat']);
      if (!name) continue;
      const c = await prisma.cutter.upsert({ where: { name }, update: {}, create: { code: str(r['MaDoiCat']) || `DC-${name}`, name } });
      cutId.set(name, c.id);
      ok('cutters');
    }
    for (const r of sheet(wb, 'tbl_DoiCat_BaoCao')) {
      const cId = cutId.get(str(r['TenDoiCat']));
      if (!cId) continue;
      const at = dt(r['NgayBaoCao']) || undefined;
      const dup = await prisma.cutterTransaction.findFirst({ where: { cutterId: cId, type: 'CHOT', amount: num(r['ThanhTien']), note: str(r['MaMam']) || null, createdAt: at } });
      if (dup) { ok('cutterTxns_skip'); continue; }
      await prisma.cutterTransaction.create({ data: { cutterId: cId, type: 'CHOT', amount: num(r['ThanhTien']), month: ym(dt(r['NgayBaoCao'])), note: str(r['MaMam']) || null, createdAt: at } });
      ok('cutterTxns');
    }
    for (const r of sheet(wb, 'tbl_DoiCat_ThanhToan')) {
      const cId = cutId.get(str(r['TenDoiCat']));
      if (!cId) continue;
      const at2 = dt(r['NgayThanhToan']) || undefined;
      const dup2 = await prisma.cutterTransaction.findFirst({ where: { cutterId: cId, type: 'TRU_NO', amount: num(r['SoTien']), note: str(r['MaBaoCaoCat']) || null, createdAt: at2 } });
      if (dup2) { ok('cutterTxns_skip'); continue; }
      await prisma.cutterTransaction.create({ data: { cutterId: cId, type: 'TRU_NO', amount: num(r['SoTien']), month: ym(dt(r['NgayThanhToan'])), note: str(r['MaBaoCaoCat']) || null, createdAt: at2 } });
      ok('cutterTxns');
    }
    // Mâm rập + size kế hoạch
    for (const r of sheet(wb, 'MaRap')) {
      if (!str(r['MaRap'])) continue;
      await prisma.rapPattern.upsert({ where: { code: str(r['MaRap']) }, update: {}, create: { code: str(r['MaRap']), name: str(r['TenMaRap']) || null } });
      ok('rapPatterns');
    }
    const phieuId = new Map<string, string>();
    for (const r of sheet(wb, 'tbl_Rap_PhieuNhap')) {
      const code = str(r['MaPhieuNhapRap']);
      if (!code) continue;
      const p = await prisma.rapPhieuNhap.upsert({ where: { code }, update: {}, create: { code, ngayCat: dt(r['NgayCat']), nhaMay: str(r['NhaMay']) || null, thoCat: str(r['ThoCat']) || null, maRap: str(r['MaRap']) || null, tongSL: Math.trunc(num(r['TongSLKeHoach'])), status: str(r['TrangThaiPhieu']) || 'Mới tạo', createdAt: dt(r['NgayTao']) || undefined } });
      phieuId.set(code, p.id);
      ok('rapPhieu');
    }
    for (const r of sheet(wb, 'tbl_Rap_SizeKeHoach')) {
      const dup = await prisma.rapSizeKeHoach.findFirst({ where: { mam: str(r['MaMam']) || 'UNKNOWN', maRap: str(r['MaRap']) || null, size: str(r['Size']) || null, color: str(r['Mau']) || null, slKeHoach: Math.trunc(num(r['SLKeHoach'])) } });
      if (dup) { ok('rapSizes_skip'); continue; }
      await prisma.rapSizeKeHoach.create({ data: { mam: str(r['MaMam']) || 'UNKNOWN', maRap: str(r['MaRap']) || null, color: str(r['Mau']) || null, size: str(r['Size']) || null, soLop: Math.trunc(num(r['SoLop'])), slKeHoach: Math.trunc(num(r['SLKeHoach'])), maHangNoiBo: str(r['MaHangNoiBo']) || null, tenSP: str(r['TenSP']) || null, phieuId: phieuId.get(str(r['MaPhieuNhapRap'])) || null } });
      ok('rapSizes');
    }
  }

  // ---- 7. PHU_LIEU: NCC + nhập/thanh toán ----
  {
    const wb = open('05_DATA_PHU_LIEU_MUA_HANG.xlsx');
    const supId = new Map<string, string>();
    async function sup(name: string, cat: any) {
      if (!name) return null;
      const key = `${cat}:${name}`;
      if (supId.has(key)) return supId.get(key)!;
      const s = await prisma.materialSupplier.upsert({ where: { name_category: { name, category: cat } }, update: {}, create: { code: `${cat}:${name}`, name, category: cat } });
      supId.set(key, s.id);
      ok('suppliers');
      return s.id;
    }
    async function mTxn(data: { supplierId: string; type: any; amount: number; note?: string | null; createdAt?: Date }) {
      const dup = await prisma.materialTransaction.findFirst({ where: { supplierId: data.supplierId, type: data.type, amount: data.amount, note: data.note || null, createdAt: data.createdAt } });
      if (dup) { ok('matTxns_skip'); return; }
      await prisma.materialTransaction.create({ data: { supplierId: data.supplierId, type: data.type, amount: data.amount, note: data.note || null, createdAt: data.createdAt } });
      ok('matTxns');
    }
    for (const r of sheet(wb, 'tbl_Vai_NhaCungCap')) {
      const id = await sup(str(r['TenNhaVai']), 'VAI');
      if (id && num(r['NoHienTai'])) { await mTxn({ supplierId: id, type: 'NHAP', amount: num(r['NoHienTai']), note: 'Nợ đầu kỳ (import)' }); }
    }
    for (const r of sheet(wb, 'tbl_Vai_Nhap')) {
      const id = await sup(str(r['TenNhaVai']), 'VAI');
      if (!id) continue;
      await mTxn({ supplierId: id, type: 'NHAP', amount: num(r['TongCong']), note: `${str(r['MaPhieuVai'])} ${str(r['LoaiVai'])}`, createdAt: dt(r['NgayNhap']) || undefined });
      if (num(r['DaThanhToan'])) { await mTxn({ supplierId: id, type: 'THANH_TOAN', amount: -num(r['DaThanhToan']), note: str(r['MaPhieuVai']), createdAt: dt(r['NgayNhap']) || undefined }); }
    }
    for (const r of sheet(wb, 'tbl_Vai_ThanhToan')) {
      const id = await sup(str(r['TenNhaVai']), 'VAI');
      if (!id) continue;
      await mTxn({ supplierId: id, type: 'THANH_TOAN', amount: -num(r['SoTien']), note: str(r['MaPhieuVai']) || null, createdAt: dt(r['NgayThanhToan']) || undefined });
    }
    for (const r of sheet(wb, 'tbl_DayKeo_Nhap')) {
      const id = await sup(str(r['NCC']), 'DAY_KEO');
      if (!id) continue;
      await mTxn({ supplierId: id, type: 'NHAP', amount: num(r['ThanhTien']), note: `${str(r['MaPhieu'])} ${str(r['LoaiDayKeo'])}`, createdAt: dt(r['Ngay']) || undefined });
    }
    for (const r of sheet(wb, 'tbl_NhatIn_GiaoDich')) {
      const id = await sup(str(r['TenDonVi']), 'IN_NHAN');
      if (!id) continue;
      await mTxn({ supplierId: id, type: 'NHAP', amount: num(r['SoTien']), note: str(r['MaChot']), createdAt: undefined });
    }
  }

  console.log('IMPORT XONG:', JSON.stringify(stats, null, 1));
  if (skips.length) console.log(`SKIP (${skips.length}):`, skips.slice(0, 30));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
