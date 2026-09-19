import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private svc: InventoryService) {}

  @Get('suggest')
  suggest(@Query('q') q: string) { return this.svc.suggest(q || ''); }

  @Get('stocks')
  stocks(@Query() query: any) { return this.svc.stocks(query); }

  @Post('inbound')
  inbound(@Body() b: any, @Req() req: any) { return this.svc.inbound(b, req.user.sub); }

  @Post('transfer')
  transfer(@Body() b: any, @Req() req: any) { return this.svc.transfer(b, req.user.sub); }

  @Post('adjust')
  adjust(@Body() b: any, @Req() req: any) { return this.svc.adjust(b, req.user.sub); }

  @Get('adjustments')
  adjustments(@Query() q: any) { return this.svc.adjustments(q); }

  @Patch('adjustments/:id/approve')
  approveAdjustment(@Param('id') id: string, @Req() req: any) { return this.svc.approveAdjustment(id, req.user.sub); }

  @Patch('adjustments/:id/reject')
  rejectAdjustment(@Param('id') id: string, @Req() req: any) { return this.svc.rejectAdjustment(id, req.user.sub); }
}
