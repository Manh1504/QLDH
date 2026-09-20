'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

export default function InvoicesPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['invs', status, page], queryFn: () => api(`/invoices?status=${status}&page=${page}&pageSize=50`) });
  const voidInv = (id: string) => {
    const reason = prompt('Lý do xóa hóa đơn?') || '';
    api(`/invoices/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) })
      .then(() => qc.invalidateQueries({ queryKey: ['invs'] })).catch((e: any) => setMsg(e.message));
  };

  return (
    <Guard>
      <h1>Hóa đơn ({data?.total ?? 0})</h1>
      {msg && <div className="err">{msg}</div>}
      <div className="card">
        <div className="row">
          <Field label="Lọc trạng thái hóa đơn"><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tất cả</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'VOID'].map((s) => <option key={s} value={s}>{vi(s)}</option>)}
          </select></Field>
        </div>
        <table><thead><tr><th>Đơn</th><th>Khách</th><th>Tổng</th><th>Đã trả</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>{(data?.data || []).map((v: any) => <InvoiceRow key={v.id} invoice={v} onVoid={voidInv} setMsg={setMsg} />)}</tbody></table>
        <div className="row" style={{ marginTop: 10 }}><button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span className="muted">Trang {page}</span><button className="ghost" disabled={page * 50 >= (data?.total || 0)} onClick={() => setPage(page + 1)}>Sau</button></div>
      </div>
    </Guard>
  );
}

function InvoiceRow({ invoice: v, onVoid, setMsg }: { invoice: any; onVoid: (id: string) => void; setMsg: (value: string) => void }) {
  const debt = Math.max(0, Number(v.total) - Number(v.paid));
  const [amount, setAmount] = useState(debt ? String(debt) : '');
  const [method, setMethod] = useState('CHUYEN_KHOAN');
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const collect = useMutation({
    mutationFn: () => api('/payments', { method: 'POST', body: JSON.stringify({ customerId: v.order.customerId, orderId: v.orderId, amount: Number(amount), method, note }) }),
    onSuccess: () => { setMsg('Đã ghi nhận thanh toán'); setAmount(''); qc.invalidateQueries({ queryKey: ['invs'] }); },
    onError: (e: any) => setMsg(e.message),
  });
  return <tr>
    <td>{v.order?.code}</td><td>{v.order?.customer?.name}</td>
    <td>{Number(v.total).toLocaleString('vi-VN')}</td><td>{Number(v.paid).toLocaleString('vi-VN')}</td>
    <td><span className={`badge ${badge(v.status)}`}>{vi(v.status)}</span></td>
    <td><div className="row">
      {debt > 0 && <><input type="number" min="1" max={debt} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 110 }} /><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CHUYEN_KHOAN">Chuyển khoản</option><option value="TIEN_MAT">Tiền mặt</option><option value="TRA_HANG">Trả hàng</option><option value="THU_THEM">Thu thêm</option></select><input placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 120 }} /><button onClick={() => collect.mutate()} disabled={!Number(amount)}>Thu tiền</button></>}
      <a href={`/invoices/${v.id}/print`} target="_blank"><button className="ghost">In</button></a>
      {v.status !== 'VOID' && <button className="danger" onClick={() => onVoid(v.id)}>Xóa</button>}
    </div></td>
  </tr>;
}
