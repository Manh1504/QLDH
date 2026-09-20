'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { Guard } from '../../../components/Shell';

export default function CustomerDetail() {
  const { id } = useParams() as { id: string };
  const [debtPage, setDebtPage] = useState(1);
  const c = useQuery({ queryKey: ['cust', id], queryFn: () => api(`/customers/${id}`) });
  const orders = useQuery({ queryKey: ['cust-orders', id], queryFn: () => api(`/orders?customerId=${id}&pageSize=20`) });
  const pays = useQuery({ queryKey: ['cust-pays', id], queryFn: () => api(`/payments?customerId=${id}&pageSize=20`) });
  const debt = useQuery({ queryKey: ['cust-debt-history', id, debtPage], queryFn: () => api(`/payments/debt/customer/${id}?page=${debtPage}&pageSize=50`) });
  const d = c.data;
  if (!d) return <Guard><div>Đang tải...</div></Guard>;
  return (
    <Guard>
      <h1>{d.name}</h1>
      <div className="stat-grid">
        <div className="stat-card"><div className="lbl">Công nợ</div><div className="stat">{Number(d.debt || 0).toLocaleString('vi-VN')}</div></div>
        <div className="stat-card green"><div className="lbl">Tổng lịch sử thu</div><div className="stat">{Number(d.paid || 0).toLocaleString('vi-VN')}</div></div>
      </div>
      <div className="muted">SĐT: {d.phone || '—'} | Địa chỉ: {d.address || '—'} | Chành xe: {d.carrierName || '—'} {d.carrierPhone || ''}</div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>Đơn hàng ({orders.data?.total ?? 0})</h3>
          {(orders.data?.data || []).map((o: any) => <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}><a href={`/orders/${o.id}`}>{o.code}</a><span className="badge">{o.status}</span></div>)}
        </div>
        <div className="card">
          <h3>Lịch sử thu tiền ({pays.data?.total ?? 0})</h3>
          <table><thead><tr><th>Ngày</th><th>Số tiền</th><th>Cách</th></tr></thead>
            <tbody>{(pays.data?.data || []).map((p: any) => (
              <tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td><td>{Number(p.amount).toLocaleString('vi-VN')}</td><td>{p.method || ''}</td></tr>
            ))}</tbody></table>
        </div>
      </div>
      <div className="card">
        <h3>Sổ công nợ đầy đủ ({debt.data?.total ?? 0})</h3>
        <table><thead><tr><th>Thời gian</th><th>Loại</th><th>Phát sinh</th><th>Chứng từ</th><th>Ghi chú</th></tr></thead><tbody>
          {(debt.data?.data || []).map((entry: any) => <tr key={entry.id}><td>{new Date(entry.createdAt).toLocaleString('vi-VN')}</td><td>{entry.type}</td><td style={{ color: Number(entry.amount) < 0 ? 'var(--green)' : 'var(--red)' }}>{Number(entry.amount).toLocaleString('vi-VN')}</td><td>{entry.documentCode || ''}</td><td>{entry.note || ''}</td></tr>)}
        </tbody></table>
        <div className="row"><button className="ghost" disabled={debtPage <= 1} onClick={() => setDebtPage(debtPage - 1)}>Trước</button><span className="muted">Trang {debtPage}</span><button className="ghost" disabled={debtPage * 50 >= (debt.data?.total || 0)} onClick={() => setDebtPage(debtPage + 1)}>Sau</button></div>
      </div>
    </Guard>
  );
}
