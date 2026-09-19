// State machine đơn hàng — dùng chung service + test
export const NEXT: Record<string, string[]> = {
  MOI: ['DANG_SOAN', 'HUY'],
  DANG_SOAN: ['XUAT_KHO', 'HUY', 'MOI'],
  XUAT_KHO: ['VAN_CHUYEN'],
  VAN_CHUYEN: ['HOA_DON'],
  HOA_DON: ['HOAN_TAT'],
  HOAN_TAT: [],
  HUY: [],
};

export function canTransition(from: string, to: string): boolean {
  return (NEXT[from] || []).includes(to);
}
