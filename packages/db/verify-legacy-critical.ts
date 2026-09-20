import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const text = (value: any) => value === null || value === undefined ? '' : String(value).trim();
const number = (value: any) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
function rows(workbook: XLSX.WorkBook, name: string): any[] {
  const worksheet = workbook.Sheets[name];
  return worksheet ? XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true }).filter((row: any) => Object.values(row).some((value) => value !== null && text(value) !== '')) : [];
}
function score(row: any) {
  return (text(row.TrangThai) === 'Mới' ? 0 : 1000000) + (number(row.TongTien) ? 100000 : 0) + Object.values(row).filter((value) => value !== null && text(value) !== '').length;
}
function equal(label: string, actual: number, expected: number) {
  if (Math.abs(actual - expected) > 0.001) throw new Error(`${label}: DB=${actual}, nguồn=${expected}`);
  console.log(`OK ${label}: ${actual}`);
}

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Thiếu thư mục XLSX');
  const sales = XLSX.readFile(`${dir}/02_DATA_SALES_CRM.xlsx`);
  const finance = XLSX.readFile(`${dir}/06_DATA_TAI_CHINH_CONG_NO.xlsx`);
  const sourceOrders = new Map<string, any>();
  for (const row of rows(sales, 'tbl_DonHang')) {
    const code = text(row.MaHoaDon); const current = sourceOrders.get(code);
    if (code && (!current || score(row) > score(current))) sourceOrders.set(code, row);
  }
  const dbOrders = await prisma.order.findMany({ where: { code: { in: [...sourceOrders.keys()] } }, select: { code: true, total: true, status: true } });
  equal('đơn chính', dbOrders.length, sourceOrders.size);
  equal('tổng tiền đơn canonical', dbOrders.reduce((sum, row) => sum + Number(row.total), 0), [...sourceOrders.values()].reduce((sum, row) => sum + number(row.TongTien), 0));

  const changed = rows(sales, 'tbl_ChiTietThayDoiDonHang');
  const changedCodes = new Set(changed.map((row) => text(row.MaHoaDon)).filter(Boolean));
  const expectedItems = changed.length + rows(sales, 'tbl_ChiTietDonHang').filter((row) => !changedCodes.has(text(row.MaHoaDon))).length;
  equal('chi tiết canonical', await prisma.orderItem.count({ where: { id: { startsWith: 'legacy_item_' } } }), expectedItems);
  equal('ảnh rời', await prisma.orderImage.count({ where: { id: { startsWith: 'legacy_img_' }, sourceId: { not: null } } }), rows(sales, 'tbl_DonHang_AnhZalo').length);
  equal('lịch sử trạng thái', await prisma.orderStatusHistory.count({ where: { id: { startsWith: 'legacy_hist_' } } }), rows(sales, 'tbl_LichSuTrangThaiDon').length);
  equal('phiếu trả', await prisma.return.count({ where: { code: { not: null } } }), rows(sales, 'tbl_HangTra').length);
  equal('chi tiết trả', await prisma.returnItem.count({ where: { id: { startsWith: 'legacy_return_item_' } } }), rows(sales, 'tbl_ChiTietHangTra').length);

  const sourcePayments = rows(finance, 'tbl_ThanhToanKhach').filter((row) => text(row.HinhThuc) !== 'Cộng thêm');
  const dbPayments = await prisma.customerPayment.aggregate({ where: { id: { startsWith: 'legacy_payment_' } }, _count: true, _sum: { amount: true } });
  equal('khoản thanh toán', dbPayments._count, sourcePayments.length);
  equal('tổng thanh toán', Number(dbPayments._sum.amount || 0), sourcePayments.reduce((sum, row) => sum + number(row.SoTien), 0));
  const sourceDebt = rows(finance, 'tbl_NhatKyNo');
  const dbDebt = await prisma.debtTransaction.aggregate({ where: { sourceKey: { startsWith: 'legacy_debt_' } }, _count: true, _sum: { amount: true } });
  equal('dòng sổ nợ', dbDebt._count, sourceDebt.length);
  equal('phát sinh nợ ròng', Number(dbDebt._sum.amount || 0), sourceDebt.reduce((sum, row) => sum + number(row.SoTien), 0));

  const consolidated = new Map(rows(finance, 'tbl_CongNo_TongHop').map((row) => [text(row.MaDoiTuong), number(row.NoHienTai)]));
  const customerDebt = new Map<string, number>();
  for (const row of rows(sales, 'tbl_KhachHang')) {
    const code = text(row.MaKhachHang); if (code && !customerDebt.has(code) && row.SoNo !== null) customerDebt.set(code, number(row.SoNo));
  }
  for (const [code, debt] of consolidated) customerDebt.set(code, debt);
  const sourceDebtBalance = [...customerDebt.values()].reduce((sum, debt) => sum + debt, 0);
  const dbCustomers = await prisma.customer.findMany({ where: { code: { in: [...customerDebt.keys()] } }, select: { debtBalance: true } });
  equal('snapshot công nợ hiện tại', dbCustomers.reduce((sum, customer) => sum + Number(customer.debtBalance), 0), sourceDebtBalance);

  const statusMap: Record<string, string> = { 'Mới': 'MOI', 'Đang soạn': 'DANG_SOAN', 'Đã soạn': 'XUAT_KHO', 'Nợ đơn': 'HOA_DON', 'Xóa': 'HUY' };
  const sourceStatuses = new Map<string, number>();
  for (const row of sourceOrders.values()) sourceStatuses.set(statusMap[text(row.TrangThai)] || 'MOI', (sourceStatuses.get(statusMap[text(row.TrangThai)] || 'MOI') || 0) + 1);
  const dbStatuses = new Map<string, number>();
  for (const row of dbOrders) dbStatuses.set(row.status, (dbStatuses.get(row.status) || 0) + 1);
  for (const [status, expected] of sourceStatuses) equal(`trạng thái ${status}`, dbStatuses.get(status) || 0, expected);
}

main().finally(() => prisma.$disconnect());
