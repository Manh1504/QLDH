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
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['orders', status, q, page], queryFn: () => api(`/orders?status=${status}&q=${encodeURIComponent(q)}&page=${page}&pageSize=50`) });

  return (
    <Guard>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Đơn hàng ({data?.total ?? 0})</h1>
        <Link href="/orders/new"><button>+ Tạo đơn</button></Link>
      </div>
      <div className="card">
        <div className="row">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            {CODES.map((s) => <option key={s} value={s}>{vi(s)}</option>)}
          </select>
          <input placeholder="Tìm mã đơn" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <table>
          <thead><tr><th>Ngày</th><th>Mã</th><th>Khách</th><th>Loại</th><th>Tổng</th><th>Đã thu</th><th>Còn lại</th><th>Trạng thái</th><th>Hóa đơn cũ</th><th>Kênh</th></tr></thead>
          <tbody>{(data?.data || []).map((o: any) => (
            <tr key={o.id}>
              <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td><td><Link href={`/orders/${o.id}`}>{o.code}</Link></td>
              <td>{o.customer?.name}</td>
              <td>{vi(o.type)}</td><td>{Number(o.total).toLocaleString('vi-VN')}</td><td>{Number(o.paid).toLocaleString('vi-VN')}</td><td>{Math.max(0, Number(o.total) - Number(o.paid)).toLocaleString('vi-VN')}</td>
              <td><span className={`badge ${badge(o.status)}`}>{vi(o.status)}</span></td><td>{o.invoiceState || '—'}</td><td>{o.salesChannel || '—'}</td>
            </tr>
          ))}</tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}><button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span className="muted">Trang {page}</span><button className="ghost" disabled={page * 50 >= (data?.total || 0)} onClick={() => setPage(page + 1)}>Sau</button></div>
      </div>
    </Guard>
  );
}
