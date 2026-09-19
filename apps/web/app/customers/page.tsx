'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function CustomersPage() {
  const [sortBy, setSortBy] = useState('debt_desc');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ code: '', name: '', phone: '', address: '', carrierName: '', carrierPhone: '', group: '', region: '' });
  const [err, setErr] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['customers', sortBy, q], queryFn: () => api(`/customers?sortBy=${sortBy}&q=${encodeURIComponent(q)}&pageSize=20`) });
  const create = useMutation({
    mutationFn: () => api('/customers', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { setForm({ code: '', name: '', phone: '', address: '', carrierName: '', carrierPhone: '', group: '', region: '' }); setErr(''); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError: (e: any) => setErr(e.message),
  });

  return (
    <Guard>
      <h1>Khách hàng ({data?.total ?? 0})</h1>
      <div className="card">
        <h3>Thêm khách</h3>
        <div className="row">
          <Field label="Mã KH *"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên khách *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SĐT"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Địa chỉ"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Chành xe"><input value={form.carrierName} onChange={(e) => setForm({ ...form, carrierName: e.target.value })} /></Field>
          <Field label="SĐT chành"><input value={form.carrierPhone} onChange={(e) => setForm({ ...form, carrierPhone: e.target.value })} /></Field>
          <Field label="Nhóm khách"><input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} /></Field>
          <Field label="Khu vực"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
          <button onClick={() => create.mutate()} disabled={!form.code || !form.name} style={{ alignSelf: 'end' }}>Thêm</button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>
      <div className="card">
        <div className="row">
          <Field label="Tìm kiếm"><input placeholder="Tên / SĐT / mã" value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <Field label="Sắp xếp"><select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="debt_desc">Nợ nhiều nhất trước</option>
            <option value="debt_asc">Nợ ít nhất trước</option>
            <option value="name">Tên A-Z</option>
          </select></Field>
        </div>
        <table>
          <thead><tr><th>Mã</th><th>Tên</th><th>SĐT</th><th>Chành xe</th><th>Công nợ</th><th>Thu tiền</th></tr></thead>
          <tbody>{(data?.data || []).map((c: any) => (
            <PayRow key={c.id} c={c} />
          ))}</tbody>
        </table>
      </div>
      <PaymentsHistory />
    </Guard>
  );
}

function PayRow({ c }: { c: any }) {
  const [amt, setAmt] = useState('');
  const [method, setMethod] = useState('TIEN_MAT');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const collect = useMutation({
    mutationFn: () => api('/payments', { method: 'POST', body: JSON.stringify({ customerId: c.id, amount: Number(amt), method, note }) }),
    onSuccess: () => { setAmt(''); setMsg('Đã thu'); qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError: (e: any) => setMsg(e.message),
  });
  return (
    <tr>
      <td>{c.code}</td><td><a href={`/customers/${c.id}`}>{c.name}</a></td><td>{c.phone}</td><td>{c.carrierName || ''}</td><td>{Number(c.debt || 0).toLocaleString('vi-VN')}</td>
      <td>
        <div className="row">
          <Field label="Số tiền thu (đ)"><input value={amt} onChange={(e) => setAmt(e.target.value)} style={{ width: 110 }} /></Field>
          <Field label="Hình thức"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="TIEN_MAT">Tiền mặt</option><option value="CHUYEN_KHOAN">Chuyển khoản</option></select></Field>
          <Field label="Ghi chú"><input value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 120 }} /></Field>
          <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => collect.mutate()}>Thu</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </td>
    </tr>
  );
}

function PaymentsHistory() {
  const { data } = useQuery({ queryKey: ['payments'], queryFn: () => api('/payments?pageSize=10') });
  if (!data?.data?.length) return null;
  return (
    <div className="card">
      <h3>Thu tiền gần đây</h3>
      <table><thead><tr><th>Ngày</th><th>Số tiền</th><th>Hình thức</th></tr></thead>
        <tbody>{data.data.map((p: any) => (
          <tr key={p.id}><td>{new Date(p.createdAt).toLocaleString('vi-VN')}</td><td>{Number(p.amount).toLocaleString('vi-VN')}</td><td>{p.method || ''}</td></tr>
        ))}</tbody></table>
    </div>
  );
}
