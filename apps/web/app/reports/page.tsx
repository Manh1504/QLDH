'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Guard } from '../../components/Shell';

export default function ReportsPage() {
  const debt = useQuery({ queryKey: ['debt'], queryFn: () => api('/reports/debt-center') });
  const cash = useQuery({ queryKey: ['cash'], queryFn: () => api('/reports/cashflow') });
  return (
    <Guard>
      <h1>Báo cáo</h1>
      <div className="grid2">
        <div className="card">
          <h3>Công nợ khách ({debt.data?.customers?.length ?? 0})</h3>
          <table><thead><tr><th>Khách</th><th>Nợ</th></tr></thead>
            <tbody>{(debt.data?.customers || []).map((c: any) => (
              <tr key={c.code}><td>{c.name}</td><td>{Number(c.debt).toLocaleString('vi-VN')}</td></tr>
            ))}</tbody></table>
        </div>
        <div className="card">
          <h3>Công nợ nhà may ({debt.data?.factories?.length ?? 0})</h3>
          <table><thead><tr><th>Nhà may</th><th>Nợ</th></tr></thead>
            <tbody>{(debt.data?.factories || []).map((f: any) => (
              <tr key={f.name}><td>{f.name}</td><td>{Number(f.debt).toLocaleString('vi-VN')}</td></tr>
            ))}</tbody></table>
        </div>
      </div>
      <div className="card">
        <h3>Dòng tiền 30 ngày</h3>
        <pre className="muted">{JSON.stringify(cash.data ?? {}, null, 1).slice(0, 800)}</pre>
      </div>
    </Guard>
  );
}
