import { Body, Controller, Param, Patch, Post, Delete, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { InvoiceService } from './invoice.service';

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoiceController {
  constructor(private svc: InvoiceService) {}
  @Post()
  create(@Body() b: { orderId: string; photoUrl?: string }, @Req() req: any) { return this.svc.create(b.orderId, b.photoUrl, req.user.sub); }
  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }
  @Patch(':id')
  update(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.svc.update(id, b, req.user.sub); }
  @Delete(':id')
  remove(@Param('id') id: string, @Body() b: { reason: string }, @Req() req: any) { return this.svc.remove(id, req.user.sub, b.reason); }
}
