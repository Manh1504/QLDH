'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Guard } from '../../components/Shell';
import Link from 'next/link';

export default function Dashboard() {
  const debt = useQuery({ queryKey: ['debt-center'], queryFn: () => api('/reports/debt-center') });
  const orders = useQuery({ queryKey: ['orders-new'], queryFn: () => api('/orders?pageSize=5') });
  const totalDebt = (debt.data?.customers || []).reduce((s: number, c: any) => s + Number(c.debt || 0), 0);
  return (
    <Guard>
      <h1>Tổng quan</h1>
      <div className="stat-grid">
        <div className="stat-card"><div className="lbl">Tổng nợ khách</div><div className="stat">{totalDebt.toLocaleString('vi-VN')}</div></div>
        <div className="stat-card green"><div className="lbl">Đơn mới</div><div className="stat">{orders.data?.total ?? 0}</div></div>
        <div className="stat-card amber"><div className="lbl">Nhà may còn nợ</div><div className="stat">{debt.data?.factories?.length ?? 0}</div></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Top nợ khách hàng</h3>
          {(debt.data?.customers || []).slice(0, 5).map((c: any) => (
            <div key={c.code} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{c.name}</span><b>{Number(c.debt).toLocaleString('vi-VN')}</b>
            </div>
          ))}
          {!debt.data?.customers?.length && <div className="muted">Chưa có công nợ</div>}
        </div>
        <div className="card">
          <h3>Đơn mới nhất</h3>
          {(orders.data?.data || []).map((o: any) => (
            <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
              <Link href={`/orders/${o.id}`}>{o.code}</Link><span className={`badge ${badge(o.status)}`}>{vi(o.status)}</span>
            </div>
          ))}
          {!orders.data?.data?.length && <div className="muted">Chưa có đơn — <Link href="/orders">tạo đơn</Link></div>}
        </div>
      </div>
    </Guard>
  );
}
