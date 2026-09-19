'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function FactoriesPage() {
  const [tab, setTab] = useState<'factory' | 'cutter'>('factory');
  const [fid, setFid] = useState('');
  const [cid, setCid] = useState('');
  const [month, setMonth] = useState('');
  const [settlementStatus, setSettlementStatus] = useState('');
  const [form, setForm] = useState({ code: '', name: '' });
  const [sp, setSp] = useState({ code: '', amount: '', note: '' });
  const [py, setPy] = useState({ amount: '', method: 'CHUYEN_KHOAN', settlementId: '', note: '' });
  const [ct, setCt] = useState({ type: 'CHOT', amount: '', month: new Date().toISOString().slice(0, 7), note: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const factories = useQuery({ queryKey: ['factories'], queryFn: () => api('/factories') });
  const cutters = useQuery({ queryKey: ['cutters'], queryFn: () => api('/cutters') });
  const settle = useQuery({ queryKey: ['settle', fid, month, settlementStatus], queryFn: () => api(`/factories/${fid}/settlements?month=${month}&status=${settlementStatus}&pageSize=50`), enabled: !!fid });
  const pay = useQuery({ queryKey: ['pay', fid], queryFn: () => api(`/factories/${fid}/payments?pageSize=50`), enabled: !!fid });
  const ctxns = useQuery({ queryKey: ['ctxns', cid, month], queryFn: () => api(`/cutters/${cid}/txns?month=${month}&pageSize=50`), enabled: !!cid });
  const create = useMutation({
    mutationFn: () => api(tab === 'factory' ? '/factories' : '/cutters', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { setForm({ code: '', name: '' }); qc.invalidateQueries(); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Nhà may / Thợ cắt</h1>
      <div className="row">
        <button className={tab === 'factory' ? '' : 'ghost'} onClick={() => setTab('factory')}>Nhà may</button>
        <button className={tab === 'cutter' ? '' : 'ghost'} onClick={() => setTab('cutter')}>Thợ cắt</button>
      </div>
      <div className="card">
        <div className="row">
          <Field label="Mã"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Tên"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <button onClick={() => create.mutate()} style={{ alignSelf: 'end' }}>Thêm {tab === 'factory' ? 'nhà may' : 'thợ cắt'}</button>
        </div>
        {msg && <div className="err">{msg}</div>}
      </div>
      {tab === 'factory' ? (
        <div className="card">
          <div className="row">
            <select value={fid} onChange={(e) => setFid(e.target.value)}>
              <option value="">— Chọn nhà may —</option>
              {(factories.data || []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input placeholder="Lọc tháng yyyy-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
            <select value={settlementStatus} onChange={(e) => setSettlementStatus(e.target.value)}><option value="">Tất cả chốt</option><option value="OPEN">Còn nợ</option><option value="PARTIAL">Trả một phần</option><option value="DONE">Đã thanh toán</option></select>
          </div>
          <h3>Tạo chốt mới (chọn nhà may ở trên trước)</h3>
          <div className="row">
            <Field label="Mã chốt"><input value={sp.code} onChange={(e) => setSp({ ...sp, code: e.target.value })} /></Field>
            <Field label="Tổng tiền chốt (đ)"><input value={sp.amount} onChange={(e) => setSp({ ...sp, amount: e.target.value })} /></Field>
            <Field label="Ghi chú chốt"><input value={sp.note} onChange={(e) => setSp({ ...sp, note: e.target.value })} /></Field>
            <button className="ghost" style={{ alignSelf: 'end' }} disabled={!fid || !sp.code} onClick={() => api(`/factories/${fid}/settle`, { method: 'POST', body: JSON.stringify({ code: sp.code, amount: Number(sp.amount), note: sp.note }) }).then(() => { setSp({ code: '', amount: '', note: '' }); qc.invalidateQueries({ queryKey: ['settle'] }); }).catch((e: any) => setMsg(e.message))}>Chốt</button>
            <Field label="Số tiền trả"><input value={py.amount} onChange={(e) => setPy({ ...py, amount: e.target.value })} style={{ width: 120 }} /></Field>
            <Field label="Trừ vào chốt"><select value={py.settlementId} onChange={(e) => setPy({ ...py, settlementId: e.target.value })}><option value="">Tự trừ chốt cũ nhất</option>{(settle.data?.data || []).filter((s: any) => s.status !== 'DONE').map((s: any) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></Field>
            <Field label="Hình thức"><select value={py.method} onChange={(e) => setPy({ ...py, method: e.target.value })}><option value="CHUYEN_KHOAN">Chuyển khoản</option><option value="TIEN_MAT">Tiền mặt</option></select></Field>
            <Field label="Lý do"><input value={py.note} onChange={(e) => setPy({ ...py, note: e.target.value })} /></Field>
            <button className="ghost" style={{ alignSelf: 'end' }} disabled={!fid || !py.amount} onClick={() => api(`/factories/${fid}/pay`, { method: 'POST', body: JSON.stringify({ ...py, settlementId: py.settlementId || undefined, amount: Number(py.amount) }) }).then(() => { setPy({ amount: '', method: 'CHUYEN_KHOAN', settlementId: '', note: '' }); qc.invalidateQueries({ queryKey: ['settle'] }); qc.invalidateQueries({ queryKey: ['pay'] }); }).catch((e: any) => setMsg(e.message))}>Trả</button>
          </div>
          <h3>Chốt ({settle.data?.total ?? 0})</h3>
          <table><thead><tr><th>Mã chốt</th><th>Tổng</th><th>Đã trả</th><th>Trạng thái</th></tr></thead>
            <tbody>{(settle.data?.data || []).map((s: any) => (
              <tr key={s.id}><td>{s.code}</td><td>{Number(s.amount).toLocaleString('vi-VN')}</td><td>{Number(s.paid).toLocaleString('vi-VN')}</td><td><span className={`badge ${badge(s.status)}`}>{vi(s.status)}</span></td></tr>
            ))}</tbody></table>
          <h3>Thanh toán ({pay.data?.total ?? 0})</h3>
          <table><thead><tr><th>Ngày</th><th>Số tiền</th><th>Hình thức</th></tr></thead>
            <tbody>{(pay.data?.data || []).map((p: any) => (
              <tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td><td>{Number(p.amount).toLocaleString('vi-VN')}</td><td>{p.method || ''}</td></tr>
            ))}</tbody></table>
        </div>
      ) : (
        <div className="card">
          <div className="row">
            <select value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">— Chọn thợ cắt —</option>
              {(cutters.data || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Lọc tháng yyyy-MM" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <Field label="Loại giao dịch"><select value={ct.type} onChange={(e) => setCt({ ...ct, type: e.target.value })}><option value="CHOT">Chốt công</option><option value="UNG">Ứng</option><option value="TRU_NO">Trừ nợ</option></select></Field>
            <Field label="Tháng"><input type="month" value={ct.month} onChange={(e) => setCt({ ...ct, month: e.target.value })} /></Field>
            <Field label="Số tiền"><input value={ct.amount} onChange={(e) => setCt({ ...ct, amount: e.target.value })} /></Field>
            <Field label="Ghi chú"><input value={ct.note} onChange={(e) => setCt({ ...ct, note: e.target.value })} /></Field>
            <button disabled={!cid || !ct.amount} style={{ alignSelf: 'end' }} onClick={() => api(`/cutters/${cid}/txns`, { method: 'POST', body: JSON.stringify({ ...ct, amount: Number(ct.amount) }) }).then(() => { setCt({ ...ct, amount: '', note: '' }); qc.invalidateQueries({ queryKey: ['ctxns'] }); }).catch((e: any) => setMsg(e.message))}>Ghi giao dịch</button>
          </div>
          <h3>Giao dịch ({ctxns.data?.total ?? 0})</h3>
          <table><thead><tr><th>Loại</th><th>Tháng</th><th>Số tiền</th></tr></thead>
            <tbody>{(ctxns.data?.data || []).map((t: any) => (
              <tr key={t.id}><td>{vi(t.type)}</td><td>{t.month}</td><td>{Number(t.amount).toLocaleString('vi-VN')}</td></tr>
            ))}</tbody></table>
        </div>
      )}
    </Guard>
  );
}
