// Shared DTO / enum dùng chung web <-> api
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'BAN_HANG' | 'KHO' | 'RAP' | 'KE_TOAN' | 'NHAN_SU' | 'BAO_CAO';
export type OrderStatus = 'MOI' | 'DANG_SOAN' | 'XUAT_KHO' | 'VAN_CHUYEN' | 'HOA_DON' | 'HOAN_TAT' | 'HUY';
export interface LoginDto { username: string; password: string; }
export interface PagedQuery { page?: number; pageSize?: number; q?: string; sortBy?: string; sortDir?: 'asc' | 'desc'; }
