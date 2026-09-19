'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function MaterialsPage() {
  const [cat, setCat] = useState('');
  const [sid, setSid] = useState('');
  const [form, setForm] = useState({ code: '', name: '', phone: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const sups = useQuery({ queryKey: ['sups', cat], queryFn: () => api(`/materials/suppliers?category=${cat}`) });
  const hist = useQuery({ queryKey: ['sup-hist', sid], queryFn: () => api(`/materials/suppliers/${sid}/txns?pageSize=50`), enabled: !!sid });
  const create = useMutation({
    mutationFn: () => api('/materials/suppliers', { method: 'POST', body: JSON.stringify({ ...form, category: cat || 'VAI' }) }),
    onSuccess: () => { setForm({ code: '', name: '', phone: '' }); qc.invalidateQueries({ queryKey: ['sups'] }); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Phụ liệu (vải / dây kéo / thêu / in)</h1>
      <div className="card">
        <div className="row">
          <Field label="Nhóm phụ liệu"><select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Tất cả nhóm</option>
            <option value="VAI">Vải</option><option value="DAY_KEO">Dây kéo</option><option value="THEU">Thêu</option><option value="IN_NHAN">In nhãn</option><option value="KHAC">Khác</option>
          </select></Field>
          <Field label="Mã NCC"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên NCC *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SĐT"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <button onClick={() => create.mutate()} style={{ alignSelf: 'end' }}>Thêm NCC</button>
        </div>
        {msg && <div className="err">{msg}</div>}
      </div>
      <div className="card">
        <div className="row">
          <Field label="NCC (xem sổ công nợ)"><select value={sid} onChange={(e) => setSid(e.target.value)}>
            <option value="">— Chọn NCC —</option>
            {(sups.data || []).map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
          </select></Field>
        </div>
        <TxnForm sid={sid} />
        <SupplierDebt sid={sid} />
        <table><thead><tr><th>Ngày</th><th>Loại</th><th>Số tiền</th><th>Ghi chú</th></tr></thead>
          <tbody>{(hist.data?.data || []).map((t: any) => (
            <tr key={t.id}><td>{new Date(t.createdAt).toLocaleDateString('vi-VN')}</td><td>{vi(t.type)}</td><td>{Number(t.amount).toLocaleString('vi-VN')}</td><td>{t.note || ''}</td></tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}

function SupplierDebt({ sid }: { sid: string }) {
  const { data } = useQuery({ queryKey: ['sup-debt', sid], queryFn: () => api(`/materials/suppliers/${sid}/debt`), enabled: Boolean(sid) });
  if (!sid) return null;
  return <div className="muted" style={{ marginBottom: 8 }}>Công nợ hiện tại: <b>{Number(data?.debt || 0).toLocaleString('vi-VN')}đ</b></div>;
}

function TxnForm({ sid }: { sid: string }) {
  const [f, setF] = useState({ type: 'NHAP', amount: '', note: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  if (!sid) return null;
  return (
    <div className="row" style={{ marginBottom: 8 }}>
      <Field label="Loại giao dịch"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
        {['NHAP', 'THANH_TOAN', 'UNG', 'CHOT'].map((t) => <option key={t} value={t}>{vi(t)}</option>)}
      </select></Field>
      <Field label="Số tiền (đ)"><input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} style={{ width: 130 }} /></Field>
      <Field label="Ghi chú"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => api(`/materials/suppliers/${sid}/txns`, { method: 'POST', body: JSON.stringify({ ...f, amount: Number(f.amount) }) }).then(() => { setF({ type: 'NHAP', amount: '', note: '' }); qc.invalidateQueries({ queryKey: ['sup-hist'] }); qc.invalidateQueries({ queryKey: ['sup-debt'] }); }).catch((e: any) => setMsg(e.message))}>Ghi sổ</button>
      {msg && <span className="err">{msg}</span>}
    </div>
  );
}
