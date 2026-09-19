'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { viewUrl } from '../../lib/upload';
import { Guard } from '../../components/Shell';

export default function AllImagesPage() {
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ['all-imgs', sort, page], queryFn: () => api(`/images?sort=${sort}&page=${page}&pageSize=24`) });
  return (
    <Guard>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Kho ảnh ({data?.total ?? 0})</h1>
        <select value={sort} onChange={(e) => { setSort(e.target.value as any); setPage(1); }}>
          <option value="newest">Mới nhất trước</option>
          <option value="oldest">Cũ nhất trước</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {(data?.data || []).map((im: any) => (
          <a key={im.id} href={viewUrl(im.url, 'w1600')} target="_blank" title={`${im.order?.code} — ${new Date(im.createdAt).toLocaleString('vi-VN')}`}>
            <img src={viewUrl(im.thumbnailUrl || im.url, 'w400')} alt="" loading="lazy" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
          </a>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
        <span className="muted">Trang {page}</span>
        <button className="ghost" onClick={() => setPage(page + 1)}>Sau</button>
      </div>
    </Guard>
  );
}
