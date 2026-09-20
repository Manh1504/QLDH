import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const stats: Record<string, number> = {};
const warnings: string[] = [];
const count = (key: string) => { stats[key] = (stats[key] || 0) + 1; };
const text = (value: any) => value === null || value === undefined ? '' : String(value).trim();
const number = (value: any) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const stableId = (prefix: string, parts: any[]) => `${prefix}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24)}`;

function rows(workbook: XLSX.WorkBook, name: string): any[] {
  const worksheet = workbook.Sheets[name];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true })
    .filter((row: any) => Object.values(row).some((value) => value !== null && text(value) !== ''));
}

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S)) : null;
  }
  const source = text(value);
  const vietnamese = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (vietnamese) return new Date(+vietnamese[3], +vietnamese[2] - 1, +vietnamese[1], +(vietnamese[4] || 0), +(vietnamese[5] || 0), +(vietnamese[6] || 0));
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function orderCreatedAt(code: string, raw: any): Date | null {
  const match = code.match(/^HD(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (!match) return parseDate(raw);
  return new Date(2000 + +match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]);
}

const ORDER_STATUS: Record<string, any> = {
  'Mới': 'MOI', 'Đang soạn': 'DANG_SOAN', 'Đã soạn': 'XUAT_KHO', 'Nợ đơn': 'HOA_DON', 'Xóa': 'HUY',
};
const RETURN_STATUS: Record<string, any> = { 'Mới': 'REQUESTED', 'Đã duyệt': 'DEBT_ADJUSTED', 'Xóa': 'REJECTED' };

function chooseOrder(current: any | undefined, candidate: any) {
  if (!current) return candidate;
  const score = (row: any) =>
    (text(row.TrangThai) === 'Mới' ? 0 : 1000000) +
    (number(row.TongTien) ? 100000 : 0) +
    Object.values(row).filter((value) => value !== null && text(value) !== '').length;
  return score(candidate) > score(current) ? candidate : current;
}

function mergeRows(current: any | undefined, candidate: any) {
  if (!current) return { ...candidate };
  const merged = { ...current };
  for (const [key, value] of Object.entries(candidate)) {
    if ((merged[key] === null || text(merged[key]) === '') && value !== null && text(value) !== '') merged[key] = value;
  }
  return merged;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Thiếu thư mục chứa XLSX');
  const sales = XLSX.readFile(`${dir}/02_DATA_SALES_CRM.xlsx`);
  const finance = XLSX.readFile(`${dir}/06_DATA_TAI_CHINH_CONG_NO.xlsx`);

  const customerSource = new Map<string, any>();
  for (const row of rows(sales, 'tbl_KhachHang')) {
    const code = text(row.MaKhachHang);
    if (code) customerSource.set(code, mergeRows(customerSource.get(code), row));
  }
  const debtSnapshots = new Map<string, number>();
  for (const row of rows(finance, 'tbl_CongNo_TongHop')) {
    const code = text(row.MaDoiTuong);
    if (code) debtSnapshots.set(code, number(row.NoHienTai));
  }

  const orderSource = new Map<string, any>();
  for (const row of rows(sales, 'tbl_DonHang')) {
    const code = text(row.MaHoaDon);
    if (code) orderSource.set(code, chooseOrder(orderSource.get(code), row));
  }

  // Keep every referenced legacy code, including records whose master row is missing.
  const referencedCustomers = new Map<string, string>();
  const rememberCustomer = (codeValue: any, nameValue?: any) => {
    const code = text(codeValue);
    if (code && !referencedCustomers.has(code)) referencedCustomers.set(code, text(nameValue) || code);
  };
  for (const row of orderSource.values()) rememberCustomer(row.MaKH, row.TenKhach);
  for (const row of rows(sales, 'tbl_DonHang_AnhZalo')) rememberCustomer(row.MaKH, row.TenKhach);
  for (const row of rows(finance, 'tbl_NhatKyNo')) rememberCustomer(row.MaDoiTuong, row.TenDoiTuong);
  for (const row of rows(finance, 'tbl_CongNo_TongHop')) rememberCustomer(row.MaDoiTuong, row.TenDoiTuong);
  for (const [code, name] of referencedCustomers) {
    if (!customerSource.has(code)) customerSource.set(code, { MaKhachHang: code, TenKhachHang: name, TrangThai: 'LEGACY_PLACEHOLDER' });
  }

  const customerIds = new Map<string, string>();
  for (const [code, row] of customerSource) {
    const debtBalance = debtSnapshots.has(code) ? debtSnapshots.get(code)! : number(row.SoNo);
    const data = {
      name: text(row.TenKhachHang) || code,
      phone: text(row.SDT) || null,
      address: text(row.DiaChi) || null,
      carrierName: text(row.ChanhXe) || null,
      carrierPhone: text(row.SDTChanhXe) || null,
      group: text(row.NhomKhach) || null,
      region: text(row.KhuVuc) || null,
      status: text(row.TrangThai) || 'ACTIVE',
      debtBalance,
      zalo: text(row.Zalo) || null,
      note: text(row.GhiChu) || null,
      sourceUpdatedAt: parseDate(row.CapNhatCuoi),
    };
    const customer = await prisma.customer.upsert({ where: { code }, update: data, create: { code, ...data, createdAt: parseDate(row.NgayTao) || undefined } });
    customerIds.set(code, customer.id);
    count('customers');
  }

  const ensureCustomer = async (codeValue: any, nameValue?: any) => {
    const code = text(codeValue) || 'LEGACY_UNKNOWN';
    const known = customerIds.get(code);
    if (known) return known;
    const customer = await prisma.customer.upsert({ where: { code }, update: {}, create: { code, name: text(nameValue) || code, status: 'LEGACY_PLACEHOLDER' } });
    customerIds.set(code, customer.id);
    return customer.id;
  };

  const orderIds = new Map<string, string>();
  for (const [code, row] of orderSource) {
    const customerId = await ensureCustomer(row.MaKH, row.TenKhach);
    const status = ORDER_STATUS[text(row.TrangThai)] || 'MOI';
    const customerNote = text(row.GhiChuKhach) || null;
    const staffNote = text(row.GhiChuNV) || null;
    const data: any = {
      customerId, type: text(row.LoaiDon) || 'LEGACY', status,
      shipDate: parseDate(row.NgayGiao), customerNote, staffNote,
      note: [customerNote, staffNote].filter(Boolean).join(' | ') || null,
      total: number(row.TongTien), paid: number(row.DaThanhToan),
      invoiceState: text(row.TrangThaiHoaDon) || null,
      salesChannel: text(row.KenhBan) || null, sourceType: text(row.KieuDon) || null,
      preparedBy: text(row.NguoiSoan) || null, creatorName: text(row.NguoiTao) || null,
      cancelledAt: parseDate(row.ThoiGianHuy), cancelledBy: text(row.NguoiHuy) || null,
      completedAt: parseDate(row.GioSoanXong), sourceUpdatedAt: parseDate(row.CapNhatCuoi),
      lockedById: null, lockedAt: null,
    };
    const order = await prisma.order.upsert({ where: { code }, update: data, create: { code, ...data, createdAt: orderCreatedAt(code, row.NgayTao) || undefined } });
    orderIds.set(code, order.id);
    count('orders');
  }

  const orphanOrderInfo = new Map<string, { customerCode: string; customerName: string }>();
  const rememberOrder = (row: any) => {
    const code = text(row.MaHoaDon);
    if (code && !orderIds.has(code)) orphanOrderInfo.set(code, { customerCode: text(row.MaKH), customerName: text(row.TenKhach) });
  };
  for (const row of rows(sales, 'tbl_ChiTietDonHang')) rememberOrder(row);
  for (const row of rows(sales, 'tbl_ChiTietThayDoiDonHang')) rememberOrder(row);
  for (const row of rows(sales, 'tbl_DonHang_AnhZalo')) rememberOrder(row);
  for (const row of rows(sales, 'tbl_LichSuTrangThaiDon')) rememberOrder(row);
  for (const [code, info] of orphanOrderInfo) {
    const customerId = await ensureCustomer(info.customerCode, info.customerName);
    const order = await prisma.order.upsert({ where: { code }, update: {}, create: { code, customerId, type: 'LEGACY_ORPHAN', status: 'HUY', note: 'Bản ghi nguồn thiếu dòng đơn hàng chính', createdAt: orderCreatedAt(code, null) || undefined } });
    orderIds.set(code, order.id);
    count('orphanOrders');
  }

  const originalItems = rows(sales, 'tbl_ChiTietDonHang');
  const changedItems = rows(sales, 'tbl_ChiTietThayDoiDonHang');
  const changedOrderCodes = new Set(changedItems.map((row) => text(row.MaHoaDon)).filter(Boolean));
  const finalItems = [...changedItems, ...originalItems.filter((row) => !changedOrderCodes.has(text(row.MaHoaDon)))];
  const itemsByOrder = new Map<string, any[]>();
  for (const row of finalItems) {
    const code = text(row.MaHoaDon);
    if (!code) continue;
    const list = itemsByOrder.get(code) || [];
    list.push(row); itemsByOrder.set(code, list);
  }
  for (const [code, sourceItems] of itemsByOrder) {
    const orderId = orderIds.get(code);
    if (!orderId) continue;
    const keepIds: string[] = [];
    for (let index = 0; index < sourceItems.length; index++) {
      const row = sourceItems[index];
      const qty = Math.trunc(number(row.SoLuong));
      if (qty <= 0) warnings.push(`Dòng đơn ${code} có số lượng không hợp lệ, giữ nguyên để đối soát`);
      const id = stableId('legacy_item', [code, index, row.TenSP, row.SoLuong, row.DonGia, row.Mau ?? row.MauChuan, row.Size, row.GhiChuSua ?? row.GhiChu]);
      keepIds.push(id);
      const data: any = {
        orderId, variantId: null, productName: text(row.TenSP) || 'Sản phẩm cũ',
        color: text(row.Mau ?? row.MauChuan) || null, size: text(row.Size) || null,
        warehouse: text(row.KhoXuat) || 'KHO_CHINH', qty, unitPrice: number(row.DonGia),
        saleType: text(row.KieuBan) || null, imageUrl: text(row.AnhSanPham) || null,
        note: text(row.GhiChuSua ?? row.GhiChu) || null,
      };
      const order = orderSource.get(code);
      if (text(order?.TrangThai) === 'Đang soạn') data.heldQty = qty;
      if (text(order?.TrangThai) === 'Đã soạn') data.exportedQty = qty;
      await prisma.orderItem.upsert({ where: { id }, update: data, create: { id, ...data } });
      count('orderItems');
    }
    // The Drive snapshot is authoritative for legacy order lines. Remove stale rows from older import attempts.
    await prisma.orderItem.deleteMany({ where: { orderId, id: { notIn: keepIds } } });
  }

  const imageRows = rows(sales, 'tbl_DonHang_AnhZalo');
  const imageUrlsByOrder = new Map<string, Set<string>>();
  for (let index = 0; index < imageRows.length; index++) {
    const row = imageRows[index];
    const code = text(row.MaHoaDon); const url = text(row.LinkAnh); const orderId = orderIds.get(code);
    if (!orderId || !url) continue;
    const id = stableId('legacy_img', [row.MaAnh, code, url]);
    await prisma.orderImage.upsert({
      where: { id },
      update: { orderId, url, sourceId: text(row.MaAnh) || null, folderId: text(row.FolderId) || null, note: text(row.GhiChu) || null, uploadedBy: text(row.NguoiUpload) || 'legacy-import', createdAt: parseDate(row.ThoiGian) || orderCreatedAt(code, null) || new Date(0) },
      create: { id, orderId, url, sourceId: text(row.MaAnh) || null, folderId: text(row.FolderId) || null, note: text(row.GhiChu) || null, uploadedBy: text(row.NguoiUpload) || 'legacy-import', createdAt: parseDate(row.ThoiGian) || orderCreatedAt(code, null) || new Date(0) },
    });
    await prisma.orderImage.deleteMany({ where: { orderId, url, id: { not: id }, uploadedBy: { in: ['import', 'legacy-import'] } } });
    const urls = imageUrlsByOrder.get(code) || new Set<string>(); urls.add(url); imageUrlsByOrder.set(code, urls);
    count('images');
  }
  for (const [code, row] of orderSource) {
    const raw = text(row.AnhZaloJson); if (!raw.startsWith('[')) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const value of parsed) {
        const url = text(value); const orderId = orderIds.get(code); if (!url || !orderId || imageUrlsByOrder.get(code)?.has(url)) continue;
        const id = stableId('legacy_img', [code, url]);
        await prisma.orderImage.upsert({ where: { id }, update: { orderId, url }, create: { id, orderId, url, uploadedBy: 'legacy-import', createdAt: orderCreatedAt(code, row.NgayTao) || new Date(0) } });
        count('inlineImages');
      }
    } catch { warnings.push(`JSON ảnh lỗi ở đơn ${code}`); }
  }

  const historyOccurrences = new Map<string, number>();
  for (const row of rows(sales, 'tbl_LichSuTrangThaiDon')) {
    const code = text(row.MaHoaDon); const orderId = orderIds.get(code); const toStatus = ORDER_STATUS[text(row.TrangThaiMoi)];
    if (!orderId || !toStatus) continue;
    const base = [code, row.ThoiGian, row.TrangThaiCu, row.TrangThaiMoi, row.NguoiThaoTac, row.GhiChu];
    const occurrenceKey = JSON.stringify(base); const occurrence = historyOccurrences.get(occurrenceKey) || 0; historyOccurrences.set(occurrenceKey, occurrence + 1);
    const id = stableId('legacy_hist', [...base, occurrence]);
    const data: any = { orderId, fromStatus: ORDER_STATUS[text(row.TrangThaiCu)] || null, toStatus, actorId: text(row.NguoiThaoTac) || 'legacy-import', note: text(row.GhiChu) || null, createdAt: parseDate(row.ThoiGian) || orderCreatedAt(code, null) || new Date(0) };
    await prisma.orderStatusHistory.upsert({ where: { id }, update: data, create: { id, ...data } }); count('history');
  }

  const returnIds = new Map<string, string>();
  for (const row of rows(sales, 'tbl_HangTra')) {
    const code = text(row.MaPhieuTra); if (!code) continue;
    const customerId = await ensureCustomer(row.MaKH, row.TenKhach);
    const data: any = { code, customerId, orderId: orderIds.get(text(row.MaHoaDonGoc)) || null, status: RETURN_STATUS[text(row.TrangThai)] || 'REQUESTED', note: text(row.GhiChu) || null, inspectedAt: parseDate(row.NgayTra), totalReturn: number(row.TongTienTra), inspector: text(row.NguoiKiem) || null, sourceUpdatedAt: parseDate(row.CapNhatCuoi) };
    const result = await prisma.return.upsert({ where: { code }, update: data, create: { ...data, createdAt: parseDate(row.NgayTra) || undefined } }); returnIds.set(code, result.id); count('returns');
  }
  const returnItemOccurrences = new Map<string, number>();
  for (const row of rows(sales, 'tbl_ChiTietHangTra')) {
    const code = text(row.MaPhieuTra); const returnId = returnIds.get(code); if (!returnId) continue;
    const base = [code, row.MaHangNoiBo, row.TenSP, row.SoLuong, row.ThanhTien, row.Mau, row.Size, row.KhoNhapLai, row.TinhTrangHang, row.GhiChu];
    const key = JSON.stringify(base); const occurrence = returnItemOccurrences.get(key) || 0; returnItemOccurrences.set(key, occurrence + 1);
    const id = stableId('legacy_return_item', [...base, occurrence]); const qty = Math.max(1, Math.trunc(number(row.SoLuong))); const total = number(row.ThanhTien);
    const data: any = { returnId, variantId: null, orderItemId: null, productName: text(row.TenSP) || text(row.MaHangNoiBo) || 'Sản phẩm trả cũ', color: text(row.Mau) || null, size: text(row.Size) || null, qty, unitPrice: total / qty, condition: text(row.TinhTrangHang) || null, reason: text(row.GhiChu) || null, warehouse: text(row.KhoNhapLai) || 'KHO_CHINH', restockedQty: 0 };
    await prisma.returnItem.upsert({ where: { id }, update: data, create: { id, ...data } }); count('returnItems');
  }

  for (const row of rows(finance, 'tbl_ThanhToanKhach')) {
    if (text(row.HinhThuc) === 'Cộng thêm') continue;
    const sourceId = text(row.MaThanhToan); const id = stableId('legacy_payment', [sourceId]); const customerId = await ensureCustomer(row.MaKH, row.TenKhach);
    const references = text(row.MaHoaDon); const tokens = references.split(/\s*\+\s*/).map((token) => token.trim()).filter(Boolean);
    const orderId = tokens.length === 1 ? orderIds.get(tokens[0]) || null : null;
    const data: any = { customerId, orderId, amount: number(row.SoTien), method: text(row.HinhThuc) || null, note: text(row.GhiChu) || null, collectedBy: text(row.NguoiThu) || null, sourceReference: references || null, createdAt: parseDate(row.NgayThanhToan) || new Date(0) };
    await prisma.customerPayment.upsert({ where: { id }, update: data, create: { id, ...data } }); count('payments');
    await prisma.customerPayment.deleteMany({ where: { id: { not: id }, customerId, amount: data.amount, method: data.method, note: data.note, createdAt: data.createdAt, sourceReference: null } });
  }

  const debtOccurrences = new Map<string, number>();
  for (const row of rows(finance, 'tbl_NhatKyNo')) {
    const base = [row.MaDoiTuong, row.ThoiGian, row.LoaiGiaoDich, row.SoTien, row.GhiChu, row.NguoiThaoTac, row.MaChungTu, row.NhomDoiTuong];
    const key = JSON.stringify(base); const occurrence = debtOccurrences.get(key) || 0; debtOccurrences.set(key, occurrence + 1);
    const sourceKey = stableId('legacy_debt', [...base, occurrence]); const subjectCode = text(row.MaDoiTuong) || 'LEGACY_UNKNOWN';
    const data: any = { sourceKey, customerId: customerIds.get(subjectCode) || null, subjectCode, subjectName: text(row.TenDoiTuong) || null, type: text(row.LoaiGiaoDich) || 'LEGACY', amount: number(row.SoTien), note: text(row.GhiChu) || null, actorName: text(row.NguoiThaoTac) || null, documentCode: text(row.MaChungTu) || null, subjectGroup: text(row.NhomDoiTuong) || null, createdAt: parseDate(row.ThoiGian) || new Date(0) };
    await prisma.debtTransaction.upsert({ where: { sourceKey }, update: data, create: { id: sourceKey, ...data } }); count('debtTransactions');
  }

  for (const [code, row] of orderSource) {
    if (!['Đã gửi đơn', 'Đã xóa đơn'].includes(text(row.TrangThaiHoaDon))) continue;
    const orderId = orderIds.get(code)!; const total = number(row.TongTien); const paid = Math.min(number(row.DaThanhToan), total);
    const status = paid <= 0 ? 'UNPAID' : paid < total ? 'PARTIAL' : 'PAID'; const deleted = text(row.TrangThaiHoaDon) === 'Đã xóa đơn';
    await prisma.invoice.upsert({ where: { orderId }, update: { total, paid, status: deleted ? 'VOID' : status, deletedAt: deleted ? parseDate(row.CapNhatCuoi) || new Date(0) : null }, create: { id: stableId('legacy_invoice', [code]), orderId, total, paid, status: deleted ? 'VOID' : status, deletedAt: deleted ? parseDate(row.CapNhatCuoi) || new Date(0) : null, createdAt: orderCreatedAt(code, row.NgayTao) || undefined } });
    count('invoices');
  }

  console.log(JSON.stringify({ stats, warnings: warnings.slice(0, 100), warningCount: warnings.length }, null, 2));
}

main().finally(() => prisma.$disconnect());
