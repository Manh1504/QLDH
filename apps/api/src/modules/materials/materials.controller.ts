import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { MaterialsService } from './materials.service';

@Controller('materials')
@UseGuards(AuthGuard)
export class MaterialsController {
  constructor(private svc: MaterialsService) {}

  @Get('suppliers')
  suppliers(@Query() q: any) { return this.svc.suppliers(q); }

  @Post('suppliers')
  create(@Body() b: { code: string; name: string; category: string; phone?: string }) {
    return this.svc.createSupplier(b.code, b.name, b.category, b.phone);
  }

  @Post('suppliers/:id/txns')
  txn(@Param('id') id: string, @Body() b: { type: string; amount: number; note?: string }) {
    return this.svc.txn(id, b.type, b.amount, b.note);
  }

  @Get('suppliers/:id/txns')
  history(@Param('id') id: string, @Query() q: any) { return this.svc.history(id, q); }

  @Get('suppliers/:id/debt')
  debt(@Param('id') id: string) { return this.svc.debt(id); }
}
