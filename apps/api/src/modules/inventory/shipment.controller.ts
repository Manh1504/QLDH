import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ShipmentService } from './shipment.service';

@Controller('shipments')
@UseGuards(AuthGuard)
export class ShipmentController {
  constructor(private svc: ShipmentService) {}
  @Post()
  create(@Body() b: { orderId: string; carrier: string }, @Req() req: any) { return this.svc.create(b.orderId, b.carrier, req.user.sub); }
  @Patch(':id')
  update(@Param('id') id: string, @Body() b: { status: string; note?: string }, @Req() req: any) { return this.svc.updateStatus(id, b.status, req.user.sub, b.note); }
}
