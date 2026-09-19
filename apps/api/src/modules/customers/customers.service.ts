import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { parsePaging } from '../../common/pagination';
import { CreateCustomerDto, UpdateCustomerDto } from './customer.dto';

// Sort khách hàng ở SQL (fix lỗi cũ sort client): name | debt_desc | debt_asc
// debt = Order.total - Order.paid (chưa có bảng công nợ tổng thì tính trực tiếp)
@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto as any });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Trùng mã khách hàng');
      throw e;
    }
  }

  async list(q: any) {
    const { page, pageSize, skip } = parsePaging(q);
    const kw = (q.q || '').trim();
    const sortBy = q.sortBy || 'debt_desc';
    const where: any = kw
      ? { OR: [{ name: { contains: kw, mode: 'insensitive' } }, { phone: { contains: kw } }, { code: { contains: kw, mode: 'insensitive' } }] }
      : {};
    if (sortBy === 'name') {
      const [total, data] = await Promise.all([
        this.prisma.customer.count({ where }),
        this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }),
      ]);
      return { data, total, page, pageSize };
    }
    // debt sort: lấy tổng nợ từng khách rồi sort ở SQL qua raw query
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT c.id, COALESCE(SUM(o."total" - o."paid"),0)::float AS debt
       FROM "Customer" c LEFT JOIN "Order" o ON o."customerId"=c.id AND o.status <> 'HUY'
       ${kw ? `WHERE c."name" ILIKE $1 OR c."phone" ILIKE $1 OR c."code" ILIKE $1` : ''}
       GROUP BY c.id ORDER BY debt ${sortBy === 'debt_asc' ? 'ASC' : 'DESC'} LIMIT $X OFFSET $Y`
        .replace('$X', String(pageSize)).replace('$Y', String(skip)),
      ...(kw ? [`%${kw}%`] : []),
    );
    const ids = rows.map((r) => r.id);
    const total: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "Customer" c ${kw ? `WHERE c."name" ILIKE $1 OR c."phone" ILIKE $1 OR c."code" ILIKE $1` : ''}`,
      ...(kw ? [`%${kw}%`] : []),
    );
    const data = ids.length ? await this.prisma.customer.findMany({ where: { id: { in: ids } } }) : [];
    const byId = new Map(data.map((d) => [d.id, d]));
    const debtById = new Map(rows.map((row) => [row.id, Number(row.debt)]));
    return { data: ids.map((id) => byId.get(id)).filter(Boolean).map((customer) => ({ ...customer, debt: debtById.get(customer!.id) || 0 })), total: total[0]?.c || 0, page, pageSize };
  }

  async get(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không thấy khách');
    const debt: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("total"-"paid"),0)::float AS debt, COALESCE(SUM("paid"),0)::float AS paid FROM "Order" WHERE "customerId"=$1 AND status <> 'HUY'`,
      id,
    );
    return { ...c, debt: debt[0]?.debt || 0, paid: debt[0]?.paid || 0 };
  }

  update(id: string, dto: UpdateCustomerDto) {
    return this.prisma.customer.update({ where: { id }, data: dto as any });
  }
}
