'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { vi, badge } from '../../lib/status';
import { Field } from '../../components/Field';
import { Guard } from '../../components/Shell';

const CODES = ['REQUESTED', 'APPROVED', 'RESTOCKED', 'DEBT_ADJUSTED', 'REJECTED'];

export default function ReturnsPage() {
  const [status, setStatus] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderId, setOrderId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ inspectedAt: new Date().toISOString().slice(0, 16), condition: 'HANG_TOT', reason: '', warehouse: 'KHO_CHINH', note: '' });
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['returns', status], queryFn: () => api(`/returns?status=${status}&pageSize=20`) });
  const orders = useQuery({ queryKey: ['return-order-search', orderQuery], queryFn: () => api(`/orders?q=${encodeURIComponent(orderQuery)}&pageSize=10`), enabled: orderQuery.trim().length >= 2 });
  const order = useQuery({ queryKey: ['return-order', orderId], queryFn: () => api(`/orders/${orderId}`), enabled: Boolean(orderId) });
  const create = useMutation({
    mutationFn: () => {
      const items = (order.data?.items || []).filter((item: any) => Number(quantities[item.id]) > 0).map((item: any) => ({ orderItemId: item.id, qty: Number(quantities[item.id]), condition: form.condition, reason: form.reason, warehouse: form.warehouse || item.warehouse }));
      if (!items.length) throw new Error('Chưa nhập số lượng sản phẩm trả');
      return api('/returns', { method: 'POST', body: JSON.stringify({ orderId, inspectedAt: form.inspectedAt, items, note: form.note }) });
    },
    onSuccess: () => { setMsg('Tạo phiếu trả OK'); setQuantities({}); qc.invalidateQueries({ queryKey: ['returns'] }); },
    onError: (e: any) => setMsg(e.message),
  });
  const act = (id: string, path: string) => api(`/returns/${id}${path}`, { method: 'POST', body: '{}' })
    .then(() => { qc.invalidateQueries({ queryKey: ['returns'] }); })
    .catch((e: any) => setMsg(e.message));

  return (
    <Guard>
      <h1>Hàng trả ({data?.total ?? 0})</h1>
      <div className="card">
        <h3>Tạo phiếu trả</h3>
        <div className="row">
          <Field label="Tìm mã đơn"><input value={orderQuery} onChange={(e) => { setOrderQuery(e.target.value); setOrderId(''); }} placeholder="Nhập ít nhất 2 ký tự" /></Field>
          <Field label="Thời gian kiểm"><input type="datetime-local" value={form.inspectedAt} onChange={(e) => setForm({ ...form, inspectedAt: e.target.value })} /></Field>
          <Field label="Tình trạng"><select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option value="HANG_TOT">Hàng tốt, nhập lại tồn</option><option value="CHO_KIEM">Chờ kiểm/hoàn thiện</option><option value="HANG_LOI">Hàng lỗi</option></select></Field>
          <Field label="Kho nhập lại"><input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} /></Field>
        </div>
        {!orderId && (orders.data?.data || []).length > 0 && <div className="row" style={{ marginTop: 8 }}>{orders.data.data.map((candidate: any) => <button className="ghost" key={candidate.id} onClick={() => { setOrderId(candidate.id); setOrderQuery(candidate.code); }}>{candidate.code} - {candidate.customer?.name}</button>)}</div>}
        {order.data && <>
          <div className="muted" style={{ marginTop: 8 }}>Khách: {order.data.customer?.name} | Trạng thái: {vi(order.data.status)}</div>
          <table><thead><tr><th>Sản phẩm</th><th>Đã xuất</th><th>Đơn giá</th><th>SL trả</th></tr></thead><tbody>
            {(order.data.items || []).filter((item: any) => item.exportedQty > 0).map((item: any) => <tr key={item.id}><td>{item.variant?.internalCode || item.productName} {item.variant ? `${item.variant.color}/${item.variant.size}` : `${item.color || ''}/${item.size || ''}`}</td><td>{item.exportedQty}</td><td>{Number(item.unitPrice).toLocaleString('vi-VN')}</td><td><input type="number" min="0" max={item.exportedQty} value={quantities[item.id] || ''} onChange={(e) => setQuantities({ ...quantities, [item.id]: e.target.value })} style={{ width: 80 }} /></td></tr>)}
          </tbody></table>
          <div className="row" style={{ marginTop: 8 }}>
            <Field label="Lý do trả"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
            <Field label="Ghi chú phiếu"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <button onClick={() => create.mutate()} disabled={create.isPending} style={{ alignSelf: 'end' }}>Tạo phiếu</button>
          </div>
        </>}
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="card">
        <div className="row">
          <Field label="Lọc trạng thái"><select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            {CODES.map((s) => <option key={s} value={s}>{vi(s)}</option>)}
          </select></Field>
        </div>
        <table><thead><tr><th>Đơn</th><th>Khách</th><th>SL dòng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{(data?.data || []).map((r: any) => (
            <tr key={r.id}>
              <td>{r.order?.code}</td><td>{r.customer?.name}</td><td>{r.items?.length}</td>
              <td><span className={`badge ${badge(r.status)}`}>{vi(r.status)}</span></td>
              <td>
                <div className="row">
                   {r.status === 'REQUESTED' && <button className="ghost" onClick={() => act(r.id, '/approve')}>Duyệt</button>}
                  {r.status === 'REQUESTED' && <button className="danger" onClick={() => act(r.id, '/reject')}>Từ chối</button>}
                  {r.status === 'APPROVED' && <button onClick={() => act(r.id, '/restock')}>Nhập lại + trừ nợ</button>}
                </div>
              </td>
            </tr>
          ))}</tbody></table>
      </div>
    </Guard>
  );
}
