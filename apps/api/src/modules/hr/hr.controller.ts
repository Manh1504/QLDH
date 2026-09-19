import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { HrService } from './hr.service';

@Controller('hr')
@UseGuards(AuthGuard)
export class HrController {
  constructor(private svc: HrService) {}

  @Get('employees')
  employees() { return this.svc.employees(); }

  @Post('employees')
  create(@Body() b: { name: string; phone?: string; position?: string; dailyWage?: number; startDate?: string }) {
    return this.svc.createEmployee(b.name, b.phone, b.position, b.dailyWage, b.startDate);
  }

  @Post('attendance')
  attendance(@Body() b: { employeeId: string; date: string; shifts: number; overtimeH?: number; bonus?: number }) {
    return this.svc.attendance(b.employeeId, b.date, b.shifts, b.overtimeH, b.bonus);
  }

  @Post('advances')
  advance(@Body() b: { employeeId: string; amount: number; note?: string }) {
    return this.svc.advance(b.employeeId, b.amount, b.note);
  }

  @Get('employees/:id/advances')
  advances(@Param('id') id: string) { return this.svc.advances(id); }

  @Get('payroll')
  payroll(@Query('month') month: string) { return this.svc.payroll(month || ''); }
}
