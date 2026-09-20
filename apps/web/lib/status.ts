// Nhãn tiếng Việt cho mọi trạng thái trong hệ thống
const VI: Record<string, string> = {
  // Đơn hàng
  MOI: 'Mới', DANG_SOAN: 'Đang soạn', XUAT_KHO: 'Xuất kho', VAN_CHUYEN: 'Vận chuyển',
  HOA_DON: 'Hóa đơn', HOAN_TAT: 'Hoàn tất', HUY: 'Hủy',
  // Vận chuyển
  CREATED: 'Mới tạo', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao', FAILED: 'Thất bại',
  // Hóa đơn
  UNPAID: 'Chưa trả', PARTIAL: 'Trả một phần', PAID: 'Đã trả đủ', VOID: 'Đã xóa',
  // Hàng trả
  REQUESTED: 'Mới yêu cầu', APPROVED: 'Đã duyệt', RESTOCKED: 'Đã nhập lại',
  DEBT_ADJUSTED: 'Đã trừ nợ', REJECTED: 'Từ chối',
  // Công nợ
  OPEN: 'Còn nợ', DONE: 'Xong',
  // Thợ cắt
  CHOT: 'Chốt', UNG: 'Ứng', TRU_NO: 'Trừ nợ',
  // Phụ liệu
  NHAP: 'Nhập', THANH_TOAN: 'Thanh toán',
  // Thẻ kho
  IN: 'Nhập', OUT: 'Xuất', TRANSFER: 'Chuyển kho', ADJUST: 'Điều chỉnh', HOLD: 'Giữ', RELEASE: 'Nhả giữ',
  // Loại đơn
  BAN_LE: 'Bán lẻ', BAN_SI: 'Bán sỉ', ZALO: 'Zalo', DON_TU_ANH: 'Đơn từ ảnh',
  TAN_XUAN: 'Tân Xuân', CA_KOI: 'Cá Koi', TAN_XUAN_CA_KOI: 'Tân Xuân và Cá Koi', KHACH_DAT: 'Khách đặt',
  'Tân Xuân': 'Tân Xuân', 'Cá Koi': 'Cá Koi', 'Khách đặt': 'Khách đặt',
};

export function vi(code: string): string {
  return VI[code] || code;
}

const BADGE: Record<string, string> = {
  MOI: '', DANG_SOAN: 'warn', XUAT_KHO: '', VAN_CHUYEN: '', HOA_DON: 'ok', HOAN_TAT: 'ok', HUY: 'bad',
  REQUESTED: 'warn', APPROVED: '', RESTOCKED: 'ok', DEBT_ADJUSTED: 'ok', REJECTED: 'bad',
  UNPAID: 'warn', PARTIAL: 'warn', PAID: 'ok', VOID: 'bad', DONE: 'ok', OPEN: 'warn',
  DELIVERED: 'ok', FAILED: 'bad', SHIPPING: 'warn', CREATED: '',
};

export function badge(code: string): string {
  return BADGE[code] || '';
}
