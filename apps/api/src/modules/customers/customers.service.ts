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
    // Dùng snapshot sổ công nợ; dữ liệu cũ không thể suy ra chính xác từ tổng đơn trừ thanh toán.
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT c.id, c."debtBalance"::float AS debt
       FROM "Customer" c
       ${kw ? `WHERE c."name" ILIKE $1 OR c."phone" ILIKE $1 OR c."code" ILIKE $1` : ''}
       ORDER BY debt ${sortBy === 'debt_asc' ? 'ASC' : 'DESC'}, c.name ASC LIMIT $X OFFSET $Y`
        .replace('$X', String(pageSize)).replace('$Y', String(skip)),
      ...(kw ? [`%${kw}%`] : []),
    );
    const ids = rows.map((r: any) => r.id);
    const total: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM "Customer" c ${kw ? `WHERE c."name" ILIKE $1 OR c."phone" ILIKE $1 OR c."code" ILIKE $1` : ''}`,
      ...(kw ? [`%${kw}%`] : []),
    );
    const data = ids.length ? await this.prisma.customer.findMany({ where: { id: { in: ids } } }) : [];
    const byId: Map<string, any> = new Map(data.map((d: any) => [d.id, d]));
    const debtById: Map<string, number> = new Map(rows.map((row: any) => [row.id, Number(row.debt)]));
    return { data: ids.map((id: string) => ({ ...byId.get(id), debt: debtById.get(id) || 0 })).filter((c: any) => c && c.code), total: total[0]?.c || 0, page, pageSize };
  }

  async get(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Không thấy khách');
    const paid = await this.prisma.customerPayment.aggregate({ where: { customerId: id }, _sum: { amount: true } });
    return { ...c, debt: Number(c.debtBalance), paid: Number(paid._sum.amount || 0) };
  }

  update(id: string, dto: UpdateCustomerDto) {
    return this.prisma.customer.update({ where: { id }, data: dto as any });
  }
}
