'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Guard } from '../../components/Shell';
import Link from 'next/link';

export default function AdminPage() {
  const qc = useQueryClient();
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api('/alerts') });
  const debt = useQuery({ queryKey: ['debt'], queryFn: () => api('/reports/debt-center') });
  const seed = useMutation({
    mutationFn: () => api('/permissions/seed', { method: 'POST', body: '{}' }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Guard>
      <h1>Quản trị tổng</h1>
      <div className="grid2">
        <div className="card">
          <h3>⚠️ Tồn khả dụng thấp ({alerts.data?.lowStock?.length ?? 0})</h3>
          {(alerts.data?.lowStock || []).slice(0, 10).map((s: any, i: number) => (
            <div key={i} className="row" style={{ justifyContent: 'space-between' }}><span>{s.internalCode} ({s.warehouse})</span><b>{s.khadung}</b></div>
          ))}
        </div>
        <div className="card">
          <h3>💰 Nợ khách cao ({alerts.data?.highDebt?.length ?? 0})</h3>
          {(alerts.data?.highDebt || []).slice(0, 10).map((c: any) => (
            <div key={c.code} className="row" style={{ justifyContent: 'space-between' }}><span>{c.name}</span><b>{Number(c.debt).toLocaleString('vi-VN')}</b></div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3>🧾 Đơn kẹt Đang soạn quá 3 ngày ({alerts.data?.stuck?.length ?? 0})</h3>
        {(alerts.data?.stuck || []).map((o: any) => <div key={o.code} className="muted">{o.code} — giữ bởi {o.lockedById}</div>)}
      </div>
      <div className="card">
        <h3>Top nợ nhà may</h3>
        {(debt.data?.factories || []).slice(0, 10).map((f: any) => (
          <div key={f.name} className="row" style={{ justifyContent: 'space-between' }}><span>{f.name}</span><b>{Number(f.debt).toLocaleString('vi-VN')}</b></div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <Link href="/permissions"><button className="ghost">Ma trận phân quyền</button></Link>
          <button className="ghost" onClick={() => seed.mutate()}>Seed quyền mặc định</button>
        </div>
      </div>
    </Guard>
  );
}
