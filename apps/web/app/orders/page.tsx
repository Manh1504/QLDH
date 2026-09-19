'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Guard } from '../../components/Shell';
import Link from 'next/link';

const CODES = ['MOI', 'DANG_SOAN', 'XUAT_KHO', 'VAN_CHUYEN', 'HOA_DON', 'HOAN_TAT', 'HUY'];

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const { data } = useQuery({ queryKey: ['orders', status], queryFn: () => api(`/orders?status=${status}&pageSize=20`) });

  return (
    <Guard>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Đơn hàng ({data?.total ?? 0})</h1>
        <Link href="/orders/new"><button>+ Tạo đơn</button></Link>
      </div>
      <div className="card">
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {CODES.map((s) => <option key={s} value={s}>{vi(s)}</option>)}
          </select>
        </div>
        <table>
          <thead><tr><th>Mã</th><th>Khách</th><th>Tổng</th><th>Trạng thái</th></tr></thead>
          <tbody>{(data?.data || []).map((o: any) => (
            <tr key={o.id}>
              <td><Link href={`/orders/${o.id}`}>{o.code}</Link></td>
              <td>{o.customer?.name}</td>
              <td>{Number(o.total).toLocaleString('vi-VN')}</td>
              <td><span className={`badge ${badge(o.status)}`}>{vi(o.status)}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Guard>
  );
}
