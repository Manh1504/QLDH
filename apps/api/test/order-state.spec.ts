import { canTransition } from '../src/modules/orders/state-machine';

describe('order state machine', () => {
  test('MOI -> DANG_SOAN ok, MOI -> XUAT_KHO sai', () => {
    expect(canTransition('MOI', 'DANG_SOAN')).toBe(true);
    expect(canTransition('MOI', 'XUAT_KHO')).toBe(false);
  });
  test('DANG_SOAN -> XUAT_KHO ok', () => {
    expect(canTransition('DANG_SOAN', 'XUAT_KHO')).toBe(true);
  });
  test('HOAN_TAT không đi đâu', () => {
    expect(canTransition('HOAN_TAT', 'MOI')).toBe(false);
  });
});
