'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { uploadImage, viewUrl } from '../../../lib/upload';
import { vi, badge } from '../../../lib/status';
import { Field } from '../../../components/Field';
import { Guard } from '../../../components/Shell';

function useOrderAction(id: string, path: string, setMsg: (s: string) => void, qc: any) {
  return useMutation({
    mutationFn: () => api(`/orders/${id}${path}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (r) => { setMsg(JSON.stringify(r?.status || r?.code || 'OK')); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e: any) => setMsg(e.message),
  });
}

export default function OrderDetail() {
  const { id } = useParams() as { id: string };
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [imgPage, setImgPage] = useState(1);
  const [imgUrl, setImgUrl] = useState('');
  const { data: o } = useQuery({ queryKey: ['order', id], queryFn: () => api(`/orders/${id}`) });
  const imgs = useQuery({ queryKey: ['order-imgs', id, sort, imgPage], queryFn: () => api(`/orders/${id}/images?sort=${sort}&page=${imgPage}&pageSize=30`) });

  const lock = useOrderAction(id, '/lock', setMsg, qc);
  const hold = useOrderAction(id, '/hold', setMsg, qc);
  const release = useOrderAction(id, '/release', setMsg, qc);
  const exp = useMutation({
    mutationFn: () => api(`/orders/${id}/export`, { method: 'POST', body: JSON.stringify({ version: o?.version }) }),
    onSuccess: (r) => { setMsg('Xuất kho OK'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e: any) => setMsg(e.message),
  });
  const ship = useMutation({
    mutationFn: (carrier: string) => api('/shipments', { method: 'POST', body: JSON.stringify({ orderId: id, carrier }) }),
    onSuccess: () => { setMsg('Tạo vận chuyển OK'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e: any) => setMsg(e.message),
  });
  const invoice = useMutation({
    mutationFn: () => api('/invoices', { method: 'POST', body: JSON.stringify({ orderId: id }) }),
    onSuccess: () => { setMsg('Sinh hóa đơn OK'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e: any) => setMsg(e.message),
  });
  const transition = useMutation({
    mutationFn: (to: string) => api(`/orders/${id}/transition`, { method: 'POST', body: JSON.stringify({ to }) }),
    onSuccess: () => { setMsg('Đã cập nhật trạng thái'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError: (e: any) => setMsg(e.message),
  });

  if (!o) return <Guard><div>Đang tải...</div></Guard>;
  return (
    <Guard>
      <h1>Đơn {o.code} <span className={`badge ${badge(o.status)}`}>{vi(o.status)}</span></h1>
      <div className="muted">Khách: {o.customer?.name} | Loại: {vi(o.type)} {o.urgent ? '| ĐƠN GẤP' : ''} | Tổng: {Number(o.total).toLocaleString('vi-VN')} | Đã thu: {Number(o.paid).toLocaleString('vi-VN')}</div>
      {(o.sourceType || o.salesChannel || o.invoiceState || o.preparedBy) && <div className="muted">Nguồn cũ: {o.sourceType || '—'} | Kênh: {o.salesChannel || '—'} | Hóa đơn: {o.invoiceState || '—'} | Người soạn: {o.preparedBy || '—'}</div>}
      <EditOrder order={o} />
      <div className="card">
        <h3>Thao tác theo vòng đời</h3>
        <div className="row">
          <button className="ghost" onClick={() => lock.mutate()}>Khóa soạn</button>
          <button className="ghost" onClick={() => hold.mutate()}>Giữ tồn (→ Đang soạn)</button>
          <button className="ghost" onClick={() => release.mutate()}>Nhả giữ</button>
          <button onClick={() => exp.mutate()}>Xuất kho (trừ tồn thật)</button>
          <button className="ghost" onClick={() => { const carrier = prompt('Chành xe', o.customer?.carrierName || '')?.trim(); if (carrier) ship.mutate(carrier); }}>Tạo vận chuyển</button>
          <button className="ghost" onClick={() => invoice.mutate()}>Sinh hóa đơn</button>
          {['MOI', 'DANG_SOAN'].includes(o.status) && <button className="danger" onClick={() => confirm('Hủy đơn này?') && transition.mutate('HUY')}>Hủy đơn</button>}
          {o.status === 'HOA_DON' && <button onClick={() => transition.mutate('HOAN_TAT')}>Hoàn tất</button>}
        </div>
        {msg && <div className="muted">{msg}</div>}
      </div>
      <div className="card">
        <h3>Dòng hàng {o.status === 'MOI' && <span className="muted">(đơn Mới: thêm/xóa được)</span>}</h3>
        <table><thead><tr><th>Ảnh</th><th>Biến thể / Tên</th><th>SL</th><th>Đơn giá</th><th>Kiểu bán</th><th>Kho</th><th>Giữ</th><th>Xuất</th><th></th></tr></thead>
          <tbody>{(o.items || []).map((i: any) => (
            <tr key={i.id}>
              <td>{i.imageUrl ? <img src={viewUrl(i.imageUrl, 'w400')} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 6 }} /> : '—'}</td>
              <td>{i.variant?.internalCode || i.productName || i.variantId} {i.variant ? `${i.variant.color}/${i.variant.size}` : i.color ? `${i.color}/${i.size || ''}` : ''}<div className="muted">{i.note || ''}</div></td>
              <td>{i.qty}</td><td>{Number(i.unitPrice).toLocaleString('vi-VN')}</td><td>{i.saleType || '—'}</td><td>{i.warehouse}</td><td>{i.heldQty}</td><td>{i.exportedQty}</td>
              <td>{o.status === 'MOI' && !i.heldQty && !i.exportedQty && (
                <button className="danger" onClick={() => {
                  api(`/orders/${id}/items/${i.id}`, { method: 'DELETE' })
                    .then(() => qc.invalidateQueries({ queryKey: ['order', id] }))
                    .catch((e: any) => setMsg(e.message));
                }}>Xóa</button>
              )}</td>
            </tr>
          ))}</tbody></table>
        {o.status === 'MOI' && <AddItem orderId={id} />}
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Lịch sử trạng thái</h3>
          {(o.history || []).map((h: any) => <div key={h.id} className="muted">{h.fromStatus ? vi(h.fromStatus) : '—'} → {vi(h.toStatus)} ({h.actorId})</div>)}
        </div>
        <div className="card">
          <h3>Ảnh đơn ({imgs.data?.total ?? 0})</h3>
          <div className="row">
            <select value={sort} onChange={(e) => { setSort(e.target.value as any); setImgPage(1); }}>
              <option value="newest">Mới nhất trước</option>
              <option value="oldest">Cũ nhất trước</option>
            </select>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input type="file" accept="image/*" multiple onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              for (const f of files) {
                try {
                  setMsg(`Đang đẩy ${f.name}...`);
                  const { url, thumbnailUrl } = await uploadImage(f);
                  await api(`/orders/${id}/images`, { method: 'POST', body: JSON.stringify({ url, thumbnailUrl }) });
                } catch (er: any) { setMsg(`Lỗi ${f.name}: ${er.message}`); }
              }
              setMsg('Đẩy ảnh xong');
              qc.invalidateQueries({ queryKey: ['order-imgs', id] });
              e.target.value = '';
            }} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input placeholder="Hoặc dán URL ảnh (Drive/R2)" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} style={{ flex: 1 }} />
            <button className="ghost" onClick={() => {
              api(`/orders/${id}/images`, { method: 'POST', body: JSON.stringify({ url: imgUrl }) })
                .then(() => { setImgUrl(''); qc.invalidateQueries({ queryKey: ['order-imgs', id] }); })
                .catch((e: any) => setMsg(e.message));
            }}>Thêm ảnh</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8, marginTop: 8 }}>
            {(imgs.data?.data || []).map((im: any) => (
              <a key={im.id} href={viewUrl(im.url, 'w1600')} target="_blank" title={new Date(im.createdAt).toLocaleString('vi-VN')}>
                <img src={viewUrl(im.thumbnailUrl || im.url, 'w400')} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
              </a>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}><button className="ghost" disabled={imgPage <= 1} onClick={() => setImgPage(imgPage - 1)}>Trước</button><span className="muted">Trang {imgPage}</span><button className="ghost" disabled={imgPage * 30 >= (imgs.data?.total || 0)} onClick={() => setImgPage(imgPage + 1)}>Sau</button></div>
        </div>
      </div>
    </Guard>
  );
}

function EditOrder({ order: o }: { order: any }) {
  const [customerNote, setCustomerNote] = useState(o.customerNote || '');
  const [staffNote, setStaffNote] = useState(o.staffNote || '');
  const [type, setType] = useState(o.type || 'TAN_XUAN');
  const [urgent, setUrgent] = useState(Boolean(o.urgent));
  const [shipDate, setShipDate] = useState(o.shipDate ? new Date(o.shipDate).toISOString().slice(0, 10) : '');
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const locked = ['VAN_CHUYEN', 'HOA_DON', 'HOAN_TAT'].includes(o.status);
  if (locked) return <div className="muted">Đơn đã đi giao — không sửa nữa (tạo hàng trả nếu cần).</div>;
  return (
    <div className="card">
      <h3>Sửa đơn</h3>
      <div className="row">
        <Field label="Loại đơn"><select value={type} onChange={(e) => setType(e.target.value)}><option value="TAN_XUAN">Tân Xuân</option><option value="CA_KOI">Cá Koi</option><option value="TAN_XUAN_CA_KOI">Tân Xuân và Cá Koi</option><option value="KHACH_DAT">Khách đặt</option></select></Field>
        <Field label="Ghi chú khách"><input value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} style={{ minWidth: 180 }} /></Field>
        <Field label="Ghi chú người soạn"><input value={staffNote} onChange={(e) => setStaffNote(e.target.value)} style={{ minWidth: 180 }} /></Field>
        <Field label="Ngày giao"><input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} /></Field>
        <Field label="Ưu tiên"><label className="row"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Đơn gấp</label></Field>
        <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => {
          api(`/orders/${o.id}`, { method: 'PATCH', body: JSON.stringify({ customerNote, staffNote, type, urgent, shipDate: shipDate || undefined }) })
            .then(() => { setMsg('Đã lưu'); qc.invalidateQueries({ queryKey: ['order', o.id] }); })
            .catch((e: any) => setMsg(e.message));
        }}>Lưu</button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  );
}

function AddItem({ orderId }: { orderId: string }) {
  const [q, setQ] = useState('');
  const [variantId, setVariantId] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [msg, setMsg] = useState('');
  const qc = useQueryClient();
  const sug = useQuery({ queryKey: ['additem-sug', q], queryFn: () => api(`/inventory/suggest?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <Field label="Tìm mã kho (gõ ≥2 ký tự)"><input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 180 }} /></Field>
      <Field label="Tên SP (nếu dòng tay)"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Số lượng"><input value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 70 }} /></Field>
      <Field label="Đơn giá"><input value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 110 }} /></Field>
      <button className="ghost" style={{ alignSelf: 'end' }} onClick={() => {
        api(`/orders/${orderId}/items`, { method: 'POST', body: JSON.stringify({ variantId: variantId || undefined, productName: variantId ? undefined : name, qty: Number(qty), unitPrice: Number(price) }) })
          .then(() => { setQ(''); setVariantId(''); setName(''); qc.invalidateQueries({ queryKey: ['order', orderId] }); })
          .catch((e: any) => setMsg(e.message));
      }}>Thêm dòng</button>
      {variantId && <span className="muted">mã đã chọn ✓ <a href="#" onClick={(e) => { e.preventDefault(); setVariantId(''); }}>bỏ</a></span>}
      {msg && <span className="err">{msg}</span>}
      {(sug.data || []).length > 0 && !variantId && (
        <div>{(sug.data || []).slice(0, 4).map((v: any) => (
          <button key={v.id} className="ghost" onClick={() => { setVariantId(v.id); setQ(v.internalCode); }}>{v.internalCode}</button>
        ))}</div>
      )}
    </div>
  );
}
