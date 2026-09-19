'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, currentUser } from '../../lib/api-client';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'BAN_HANG', 'KHO', 'RAP', 'KE_TOAN', 'NHAN_SU', 'BAO_CAO'];
const ROLE_VI: Record<string, string> = { OWNER: 'Chủ', ADMIN: 'Quản trị', MEMBER: 'Thành viên', BAN_HANG: 'Bán hàng', KHO: 'Kho', RAP: 'Rập/Xưởng', KE_TOAN: 'Kế toán', NHAN_SU: 'Nhân sự', BAO_CAO: 'Báo cáo' };

export default function UsersPage() {
  const [form, setForm] = useState({ username: '', password: '', name: '', roles: ['MEMBER'] as string[] });
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const me = currentUser();
  const isAdmin = (me?.roles || []).some((r: string) => ['OWNER', 'ADMIN'].includes(r));
  const isOwner = (me?.roles || []).includes('OWNER');
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => api('/users?pageSize=50'), enabled: isAdmin });

  const create = useMutation({
    mutationFn: () => api('/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { setForm({ username: '', password: '', name: '', roles: ['MEMBER'] }); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e: any) => setMsg(e.message),
  });
  const setRoles = (id: string, roles: string[]) => {
    api(`/users/${id}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) })
      .then(() => qc.invalidateQueries({ queryKey: ['users'] }))
      .catch((e: any) => setMsg(e.message));
  };
  const changePw = useMutation({
    mutationFn: () => api('/auth/change-password', { method: 'POST', body: JSON.stringify(pw) }),
    onSuccess: () => { setMsg('Đổi mật khẩu OK'); setPw({ oldPassword: '', newPassword: '' }); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Tài khoản & phân quyền</h1>
      <div className="grid2">
        <div className="card">
          <h3>Đổi mật khẩu của tôi</h3>
          <div className="row">
            <Field label="Mật khẩu cũ"><input type="password" value={pw.oldPassword} onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })} /></Field>
            <Field label="Mật khẩu mới"><input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <button onClick={() => changePw.mutate()} style={{ alignSelf: 'end' }}>Đổi</button>
          </div>
        </div>
        {isAdmin && (
          <div className="card">
            <h3>Tạo tài khoản (gán nhiều vai trò)</h3>
            <div className="row">
              <Field label="Tên đăng nhập *"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
              <Field label="Mật khẩu *"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="Tên nhân viên *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <button onClick={() => create.mutate()} style={{ alignSelf: 'end' }}>Tạo</button>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {ROLES.filter((r) => r !== 'OWNER' || isOwner).map((r) => (
                <label key={r} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={(e) => setForm({ ...form, roles: e.target.checked ? [...form.roles, r] : form.roles.filter((x) => x !== r) })} />
                  {ROLE_VI[r]}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      {msg && <div className="muted">{msg}</div>}
      {isAdmin && (
        <div className="card">
          <h3>Danh sách ({data?.total ?? 0})</h3>
          <table><thead><tr><th>Username</th><th>Tên</th><th>Vai trò (owner tick để gán)</th><th>Trạng thái</th></tr></thead>
            <tbody>{(data?.data || []).map((u: any) => (
              <tr key={u.id}>
                <td>{u.username}</td><td>{u.name}</td>
                <td>
                  <div className="row">
                    {ROLES.filter((r) => r !== 'OWNER' || isOwner).map((r) => (
                      <label key={r} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                        <input type="checkbox" checked={(u.roles || []).includes(r)} disabled={!isOwner && r === 'OWNER'}
                          onChange={(e) => {
                            const next = e.target.checked ? [...(u.roles || []), r] : (u.roles || []).filter((x: string) => x !== r);
                            setRoles(u.id, next);
                          }} />
                        {ROLE_VI[r]}
                      </label>
                    ))}
                  </div>
                </td>
                <td>{u.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
      {!isAdmin && <div className="muted">Chỉ ADMIN/OWNER xem được danh sách tài khoản.</div>}
    </Guard>
  );
}
