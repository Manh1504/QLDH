'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Guard } from '../../components/Shell';

export default function AuditPage() {
  const [entity, setEntity] = useState('');
  const { data } = useQuery({ queryKey: ['audit', entity], queryFn: () => api(`/audit-logs?entity=${entity}&pageSize=30`) });
  return (
    <Guard>
      <h1>Nhật ký thao tác ({data?.total ?? 0})</h1>
      <div className="card">
        <div className="row">
          <select value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">Tất cả</option>
            {['Invoice', 'Return', 'Customer', 'Order'].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <table><thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Actor</th></tr></thead>
          <tbody>{(data?.data || []).map((a: any) => (
            <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString('vi-VN')}</td><td>{a.action}</td><td>{a.entityType}/{a.entityId.slice(0, 8)}</td><td className="muted">{a.actorId.slice(0, 8)}</td></tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}
