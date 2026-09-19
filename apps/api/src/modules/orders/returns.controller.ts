import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { ReturnsService } from './returns.service';

@Controller()
@UseGuards(AuthGuard)
export class ReturnsController {
  constructor(private svc: ReturnsService) {}

  @Post('returns')
  create(@Body() b: { orderId: string; inspectedAt?: string; items: { orderItemId?: string; variantId?: string; qty: number; condition?: string; reason?: string; warehouse?: string; location?: string }[]; note?: string }, @Req() req: any) {
    return this.svc.create(b.orderId, b.items, b.note, b.inspectedAt, req.user.sub);
  }

  @Post('returns/:id/approve')
  approve(@Param('id') id: string, @Req() req: any) { return this.svc.approve(id, req.user.sub); }

  @Post('returns/:id/reject')
  reject(@Param('id') id: string, @Body() b: { note?: string }, @Req() req: any) { return this.svc.reject(id, b.note, req.user.sub); }

  @Post('returns/:id/restock')
  restock(@Param('id') id: string, @Req() req: any) { return this.svc.restockAndAdjustDebt(id, req.user.sub); }

  @Get('orders/:id/images')
  images(@Param('id') id: string, @Query() q: any) {
    return this.svc.images(id, q.sort === 'oldest' ? 'oldest' : 'newest', Number(q.page || 1), Number(q.pageSize || 20));
  }

  @Post('orders/:id/images')
  addImage(@Param('id') id: string, @Body() b: { url: string; thumbnailUrl?: string }, @Req() req: any) {
    return this.svc.addImage(id, b.url, b.thumbnailUrl, req.user.sub);
  }
}
