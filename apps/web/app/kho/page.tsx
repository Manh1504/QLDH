'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function KhoPage() {
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ internalCode: '', salesCode: '', productCode: '', productName: '', color: '', size: '', warehouse: 'KHO_CHINH', location: '', qty: '10' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data: sug } = useQuery({ queryKey: ['suggest', q], queryFn: () => api(`/inventory/suggest?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  const { data: stocks } = useQuery({ queryKey: ['stocks'], queryFn: () => api('/inventory/stocks?pageSize=20') });
  const inbound = useMutation({
    mutationFn: () => api('/inventory/inbound', { method: 'POST', body: JSON.stringify({ ...form, qty: Number(form.qty) }) }),
    onSuccess: () => { setMsg('Nhập kho OK'); qc.invalidateQueries({ queryKey: ['stocks'] }); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Kho — nhập tay + gợi ý dần</h1>
      <div className="card">
        <h3>Nhập kho tay</h3>
        <div className="row">
          <Field label="Mã nội bộ *"><input value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })} /></Field>
          <Field label="Mã bán"><input value={form.salesCode} onChange={(e) => setForm({ ...form, salesCode: e.target.value })} /></Field>
          <Field label="Mã SP *"><input value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} /></Field>
          <Field label="Tên SP *"><input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field>
          <Field label="Màu"><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 90 }} /></Field>
          <Field label="Size"><input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} style={{ width: 80 }} /></Field>
          <Field label="Kho"><input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} style={{ width: 110 }} /></Field>
          <Field label="Vị trí"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: 90 }} /></Field>
          <Field label="Số lượng"><input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} style={{ width: 80 }} /></Field>
          <button onClick={() => inbound.mutate()} style={{ alignSelf: 'end' }}>Nhập</button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Tra mã hàng (gõ ≥2 ký tự)</h3>
          <Field label="Mã bán / mã nội bộ"><input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} /></Field>
          {(sug || []).map((v: any) => <div key={v.id} className="muted">{v.internalCode} — {v.salesCode} — {v.color}/{v.size} (id: {v.id})</div>)}
        </div>
        <div className="card">
          <h3>Tồn kho ({stocks?.total ?? 0})</h3>
          <table><thead><tr><th>Biến thể</th><th>Kho</th><th>Tồn</th><th>Giữ</th></tr></thead>
            <tbody>{(stocks?.data || []).map((s: any) => (
              <tr key={s.id}><td>{s.variant?.internalCode}</td><td>{s.warehouse}</td><td>{s.onHand}</td><td>{s.held}</td></tr>
            ))}</tbody></table>
        </div>
      </div>
      <TransferAdjust />
      <AdjustmentRequests />
      <Ledger />
    </Guard>
  );
}

function TransferAdjust() {
  const [t, setT] = useState({ variantId: '', from: 'KHO_CHINH', to: '', qty: '1' });
  const [a, setA] = useState({ variantId: '', warehouse: 'KHO_CHINH', newQty: '0', reason: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  return (
    <div className="grid2">
      <div className="card">
        <h3>Chuyển kho nội bộ</h3>
        <div className="row">
          <Field label="Mã biến thể (lấy ở tra mã)"><input value={t.variantId} onChange={(e) => setT({ ...t, variantId: e.target.value })} /></Field>
          <Field label="Kho nguồn"><input value={t.from} onChange={(e) => setT({ ...t, from: e.target.value })} style={{ width: 110 }} /></Field>
          <Field label="Kho đích"><input value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })} style={{ width: 110 }} /></Field>
          <Field label="Số lượng"><input value={t.qty} onChange={(e) => setT({ ...t, qty: e.target.value })} style={{ width: 70 }} /></Field>
          <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => api('/inventory/transfer', { method: 'POST', body: JSON.stringify({ ...t, qty: Number(t.qty) }) }).then(() => { setMsg('Chuyển OK'); qc.invalidateQueries({ queryKey: ['stocks'] }); }).catch((e: any) => setMsg(e.message))}>Chuyển</button>
        </div>
      </div>
      <div className="card">
        <h3>Gửi yêu cầu điều chỉnh tồn</h3>
        <div className="row">
          <Field label="Mã biến thể"><input value={a.variantId} onChange={(e) => setA({ ...a, variantId: e.target.value })} /></Field>
          <Field label="Tồn mới"><input value={a.newQty} onChange={(e) => setA({ ...a, newQty: e.target.value })} style={{ width: 90 }} /></Field>
          <Field label="Lý do"><input value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} /></Field>
          <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => api('/inventory/adjust', { method: 'POST', body: JSON.stringify({ ...a, newQty: Number(a.newQty) }) }).then(() => { setMsg('Đã gửi yêu cầu chờ duyệt'); qc.invalidateQueries({ queryKey: ['adjustments'] }); }).catch((e: any) => setMsg(e.message))}>Gửi yêu cầu</button>
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
    </div>
  );
}

function AdjustmentRequests() {
  const [status, setStatus] = useState('PENDING');
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['adjustments', status], queryFn: () => api(`/inventory/adjustments?status=${status}&pageSize=20`) });
  const act = (id: string, action: 'approve' | 'reject') => api(`/inventory/adjustments/${id}/${action}`, { method: 'PATCH', body: '{}' })
    .then(() => { setMsg(action === 'approve' ? 'Đã duyệt điều chỉnh' : 'Đã từ chối'); qc.invalidateQueries({ queryKey: ['adjustments'] }); qc.invalidateQueries({ queryKey: ['stocks'] }); })
    .catch((e: any) => setMsg(e.message));
  return <div className="card">
    <div className="row" style={{ justifyContent: 'space-between' }}><h3>Yêu cầu kiểm kê/điều chỉnh ({data?.total ?? 0})</h3><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="">Tất cả</option></select></div>
    {msg && <div className="muted">{msg}</div>}
    <table><thead><tr><th>Mã biến thể</th><th>Kho</th><th>Tồn lúc tạo</th><th>Tồn đề nghị</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>{(data?.data || []).map((request: any) => <tr key={request.id}><td>{request.variantId}</td><td>{request.warehouse}</td><td>{request.oldQty}</td><td>{request.newQty}</td><td>{request.reason}</td><td>{request.status}</td><td>{request.status === 'PENDING' && <div className="row"><button onClick={() => act(request.id, 'approve')}>Duyệt</button><button className="danger" onClick={() => act(request.id, 'reject')}>Từ chối</button></div>}</td></tr>)}</tbody></table>
  </div>;
}

function Ledger() {
  const { data } = useQuery({ queryKey: ['ledger'], queryFn: () => api('/inventory/ledger?pageSize=15') });
  if (!data?.data?.length) return null;
  return (
    <div className="card">
      <h3>Thẻ kho gần đây</h3>
      <table><thead><tr><th>Thời gian</th><th>Loại</th><th>SL đổi</th><th>Chứng từ</th></tr></thead>
        <tbody>{data.data.map((t: any) => (
          <tr key={t.id}><td>{new Date(t.createdAt).toLocaleString('vi-VN')}</td><td><span className="badge">{vi(t.type)}</span></td><td>{t.qty}</td><td className="muted">{t.refCode}</td></tr>
        ))}</tbody></table>
    </div>
  );
}
