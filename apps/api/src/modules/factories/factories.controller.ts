import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { FactoriesService } from './factories.service';

@Controller()
@UseGuards(AuthGuard)
export class FactoriesController {
  constructor(private svc: FactoriesService) {}

  @Get('factories')
  factories(@Query() q: any) { return this.svc.factories(q); }

  @Post('factories')
  createFactory(@Body() b: { code: string; name: string }) { return this.svc.createFactory(b.code, b.name); }

  @Post('factories/:id/settle')
  settle(@Param('id') id: string, @Body() b: { code: string; amount: number; note?: string }) {
    return this.svc.settle(id, b.code, b.amount, b.note);
  }

  @Post('factories/:id/pay')
  pay(@Param('id') id: string, @Body() b: { amount: number; settlementId?: string; method?: string; note?: string }) {
    return this.svc.pay(id, b.amount, b.settlementId, b.method, b.note);
  }

  @Get('factories/:id/settlements')
  settlements(@Param('id') id: string, @Query() q: any) { return this.svc.settlementHistory(id, q); }

  @Get('factories/:id/payments')
  payments(@Param('id') id: string, @Query() q: any) { return this.svc.paymentHistory(id, q); }

  @Get('cutters')
  cutters(@Query() q: any) { return this.svc.cutters(q); }

  @Post('cutters')
  createCutter(@Body() b: { code: string; name: string }) { return this.svc.createCutter(b.code, b.name); }

  @Post('cutters/:id/txns')
  cutterTxn(@Param('id') id: string, @Body() b: { type: string; amount: number; month: string; note?: string }) {
    return this.svc.cutterTxn(id, b.type, b.amount, b.month, b.note);
  }

  @Get('cutters/:id/txns')
  cutterHistory(@Param('id') id: string, @Query() q: any) { return this.svc.cutterHistory(id, q); }
}
