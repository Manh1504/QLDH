'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { currentUser, logout } from '../lib/api-client';

const NAV: [string, string, string][] = [
  ['/dashboard', 'Tổng quan', '◈'],
  ['/orders', 'Đơn hàng', '🧾'],
  ['/orders/new', 'Tạo đơn', '➕'],
  ['/returns', 'Hàng trả', '↩️'],
  ['/invoices', 'Hóa đơn', '🧷'],
  ['/shipping', 'Vận chuyển', '🚚'],
  ['/customers', 'Khách hàng', '👥'],
  ['/kho', 'Kho', '📦'],
  ['/images', 'Kho ảnh', '🖼️'],
  ['/rap', 'Rập / Xưởng', '🏭'],
  ['/factories', 'Nhà may / Thợ cắt', '🏭'],
  ['/materials', 'Phụ liệu', '🧵'],
  ['/hr', 'Nhân sự', '🙋'],
  ['/reports', 'Báo cáo', '📊'],
  ['/admin', 'Quản trị', '👑'],
  ['/audit', 'Nhật ký', '📝'],
  ['/users', 'Tài khoản', '🔐'],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const me = typeof window !== 'undefined' ? currentUser() : null;
  return (
    <div className="shell">
      <nav className="side">
        <h2>✂ Azalas</h2>
        <div className="tag">Xưởng may · QLDH</div>
        {NAV.map(([href, label, icon]) => (
          <Link key={href} href={href} className={path === href || path.startsWith(href + '/') ? 'active' : ''}>
            <span>{icon}</span> {label}
          </Link>
        ))}
        <div className="me">
          <div>{me?.name || me?.username || ''}</div>
          <div>{(me?.roles || []).join(', ')}</div>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }} style={{ padding: 0, marginTop: 6 }}>Đăng xuất</a>
        </div>
      </nav>
      <div className="main">{children}</div>
    </div>
  );
}

export function Guard({ children }: { children: React.ReactNode }) {
  if (typeof window !== 'undefined' && !localStorage.getItem('azalas_access')) {
    window.location.href = '/login';
    return null;
  }
  return <Shell>{children}</Shell>;
}
