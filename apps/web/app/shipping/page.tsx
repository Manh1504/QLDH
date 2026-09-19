'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function ShippingPage() {
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ships', status], queryFn: () => api(`/shipments?status=${status}&pageSize=20`) });
  const adv = (id: string, to: string) => api(`/shipments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: to }) })
    .then(() => qc.invalidateQueries({ queryKey: ['ships'] })).catch((e: any) => setMsg(e.message));

  return (
    <Guard>
      <h1>Vận chuyển ({data?.total ?? 0})</h1>
      <div className="card">
        <div className="row">
          <Field label="Lọc trạng thái vận chuyển"><select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {['CREATED', 'SHIPPING', 'DELIVERED', 'FAILED'].map((s) => <option key={s} value={s}>{vi(s)}</option>)}
          </select></Field>
        </div>
        {msg && <div className="err">{msg}</div>}
        <table><thead><tr><th>Đơn</th><th>Chành xe</th><th>Trạng thái</th><th>Lịch sử</th><th></th></tr></thead>
          <tbody>{(data?.data || []).map((s: any) => (
            <tr key={s.id}>
              <td>{s.order?.code}</td><td>{s.carrier}</td>
              <td><span className={`badge ${badge(s.status)}`}>{vi(s.status)}</span></td>
              <td className="muted">{(s.history || []).map((h: any) => vi(h.event)).join(' → ')}</td>
              <td>
                <div className="row">
                   {s.status === 'CREATED' && <button className="ghost" onClick={() => adv(s.id, 'SHIPPING')}>Giao</button>}
                   {s.status === 'SHIPPING' && <button className="ghost" onClick={() => adv(s.id, 'DELIVERED')}>Đã giao</button>}
                  {['CREATED', 'SHIPPING'].includes(s.status) && <button className="danger" onClick={() => adv(s.id, 'FAILED')}>Trả hàng/Lỗi giao</button>}
                  {s.status === 'FAILED' && <button className="ghost" onClick={() => adv(s.id, 'SHIPPING')}>Giao lại</button>}
                </div>
              </td>
            </tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}
