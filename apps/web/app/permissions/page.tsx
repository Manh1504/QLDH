'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Guard } from '../../components/Shell';

const ROLES = ['OWNER', 'ADMIN', 'BAN_HANG', 'KHO', 'RAP', 'KE_TOAN', 'NHAN_SU', 'BAO_CAO', 'MEMBER'];
const PERMS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canApprove'];

export default function PermissionsPage() {
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['perms'], queryFn: () => api('/permissions') });
  const toggle = useMutation({
    mutationFn: ({ role, module, perm, val }: any) => {
      const cur = data?.matrix?.[role]?.[module] || {};
      return api(`/permissions/${role}/${module}`, { method: 'PATCH', body: JSON.stringify({ ...cur, [perm]: val }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perms'] }),
    onError: (e: any) => setMsg(e.message),
  });
  return (
    <Guard>
      <h1>Ma trận phân quyền (chỉ OWNER sửa)</h1>
      {msg && <div className="err">{msg}</div>}
      {(data?.modules || []).map((m: string) => (
        <div className="card" key={m}>
          <h3>{m}</h3>
          <table><thead><tr><th>Role</th>{PERMS.map((p) => <th key={p}>{p.replace('can', '')}</th>)}</tr></thead>
            <tbody>{ROLES.map((r) => (
              <tr key={r}>
                <td><b>{r}</b></td>
                {PERMS.map((p) => (
                  <td key={p}><input type="checkbox" checked={!!data?.matrix?.[r]?.[m]?.[p]} onChange={(e) => toggle.mutate({ role: r, module: m, perm: p, val: e.target.checked })} /></td>
                ))}
              </tr>
            ))}</tbody></table>
        </div>
      ))}
    </Guard>
  );
}
