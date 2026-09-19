'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function RapPage() {
  const [maRap, setMaRap] = useState('');
  const [form, setForm] = useState({ nhaMay: '', thoCat: '', maRap: '', sizeText: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['rap-phieu', maRap], queryFn: () => api(`/rap/phieu?maRap=${encodeURIComponent(maRap)}&pageSize=20`) });
  const patterns = useQuery({ queryKey: ['rap-pat'], queryFn: () => api('/rap/patterns') });
  const create = useMutation({
    mutationFn: () => {
      const sizes = form.sizeText.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [size, sl] = l.split(':');
        return { size: (size || '').trim(), slKeHoach: Number(sl || 0) };
      });
      return api('/rap/phieu', { method: 'POST', body: JSON.stringify({ nhaMay: form.nhaMay, thoCat: form.thoCat, maRap: form.maRap, sizes }) });
    },
    onSuccess: () => { setForm({ nhaMay: '', thoCat: '', maRap: '', sizeText: '' }); setMsg('Tạo phiếu rập OK'); qc.invalidateQueries({ queryKey: ['rap-phieu'] }); },
    onError: (e: any) => setMsg(e.message),
  });

  return (
    <Guard>
      <h1>Rập / Xưởng ({data?.total ?? 0} phiếu)</h1>
      <div className="card">
        <h3>Tạo phiếu nhập rập</h3>
        <div className="row">
          <Field label="Nhà may giao"><input value={form.nhaMay} onChange={(e) => setForm({ ...form, nhaMay: e.target.value })} /></Field>
          <Field label="Thợ cắt"><input value={form.thoCat} onChange={(e) => setForm({ ...form, thoCat: e.target.value })} /></Field>
          <Field label="Mã rập (gõ để gợi ý)"><input value={form.maRap} onChange={(e) => setForm({ ...form, maRap: e.target.value })} list="rap-codes" /></Field>
          <datalist id="rap-codes">{(patterns.data || []).map((p: any) => <option key={p.id} value={p.code} />)}</datalist>
        </div>
        <Field label='Size kế hoạch — mỗi dòng "SIZE:Số lượng", VD: M:100' style={{ width: '100%', marginTop: 8 }}><textarea value={form.sizeText} onChange={(e) => setForm({ ...form, sizeText: e.target.value })} rows={3} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', padding: 8 }} /></Field>
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={() => create.mutate()}>Tạo phiếu</button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      </div>
      <div className="card">
        <div className="row">
          <Field label="Lọc theo mã rập"><input value={maRap} onChange={(e) => setMaRap(e.target.value)} /></Field>
        </div>
        <table><thead><tr><th>Mã phiếu</th><th>Ngày cắt</th><th>Nhà may</th><th>Mã rập</th><th>Tổng SL</th><th>Trạng thái</th><th>Size</th></tr></thead>
          <tbody>{(data?.data || []).map((p: any) => (
            <tr key={p.id}>
              <td>{p.code}</td><td>{p.ngayCat ? new Date(p.ngayCat).toLocaleDateString('vi-VN') : ''}</td>
              <td>{p.nhaMay}</td><td>{p.maRap}</td><td>{p.tongSL}</td><td><span className="badge">{p.status}</span></td>
              <td className="muted">{(p.sizes || []).map((s: any) => `${s.size}:${s.slKeHoach}`).join(', ')}</td>
            </tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}
