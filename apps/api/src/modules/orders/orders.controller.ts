import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto, TransitionDto } from './order.dto';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private svc: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: any) { return this.svc.create(dto, req.user.sub); }

  @Get()
  list(@Query() q: any) { return this.svc.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(id); }

  @Post(':id/lock')
  lock(@Param('id') id: string, @Req() req: any) { return this.svc.lock(id, req.user.sub); }

  @Post(':id/unlock')
  unlock(@Param('id') id: string, @Req() req: any) { return this.svc.unlock(id, req.user.sub); }

  @Post(':id/hold')
  hold(@Param('id') id: string, @Req() req: any) { return this.svc.hold(id, req.user.sub); }

  @Post(':id/release')
  release(@Param('id') id: string, @Req() req: any) { return this.svc.release(id, req.user.sub); }

  @Post(':id/export')
  exp(@Param('id') id: string, @Req() req: any, @Body() b: { version: number }) { return this.svc.export(id, req.user.sub, b.version); }

  @Post(':id/transition')
  transition(@Param('id') id: string, @Body() dto: TransitionDto, @Req() req: any) { return this.svc.transition(id, dto.to, req.user.sub, dto.note); }

  // Sửa đơn: thông tin chung sửa được tới trước Vận chuyển; dòng hàng chỉ khi Mới
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) { return this.svc.update(id, dto, req.user.sub); }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: any, @Req() req: any) { return this.svc.addItem(id, dto, req.user.sub); }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @Req() req: any) { return this.svc.removeItem(id, itemId, req.user.sub); }
}
