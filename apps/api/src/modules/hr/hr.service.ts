import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  employees() { return this.prisma.employee.findMany({ orderBy: { name: 'asc' } }); }

  createEmployee(name: string, phone?: string, position?: string, dailyWage?: number, startDate?: string) {
    return this.prisma.employee.create({ data: { name, phone, position, dailyWage, startDate: startDate ? new Date(startDate) : null } });
  }

  attendance(employeeId: string, date: string, shifts: number, overtimeH = 0, bonus = 0) {
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: new Date(date) } },
      update: { shifts, overtimeH, bonus },
      create: { employeeId, date: new Date(date), shifts, overtimeH, bonus },
    });
  }

  advance(employeeId: string, amount: number, note?: string) {
    return this.prisma.salaryAdvance.create({ data: { employeeId, amount, note } });
  }

  advances(employeeId: string) {
    return this.prisma.salaryAdvance.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  // Quy đổi tăng ca theo lương giờ (lương ngày / 8), sau đó cộng thưởng và trừ ứng trong đúng tháng.
  async payroll(month: string) {
    const effectiveMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const from = new Date(`${effectiveMonth}-01T00:00:00`);
    const to = new Date(from); to.setMonth(to.getMonth() + 1);
    const emps = await this.prisma.employee.findMany({ include: { attendance: { where: { date: { gte: from, lt: to } } }, advances: { where: { createdAt: { gte: from, lt: to } } } } });
    const out: any[] = [];
    for (const e of emps) {
      const atts = e.attendance;
      const advs = e.advances;
      const totalShifts = atts.reduce((s, a) => s + Number(a.shifts), 0);
      const overtimeH = atts.reduce((s, a) => s + Number(a.overtimeH), 0);
      const bonus = atts.reduce((s, a) => s + Number(a.bonus), 0);
      const totalAdv = advs.reduce((s, a) => s + Number(a.amount), 0);
      const dailyWage = Number(e.dailyWage || 0);
      out.push({ employee: e.name, totalShifts, overtimeH, bonus, totalAdv, estimate: totalShifts * dailyWage + overtimeH * dailyWage / 8 + bonus - totalAdv });
    }
    return { month: effectiveMonth, rows: out };
  }
}
