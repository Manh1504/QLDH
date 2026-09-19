import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { UploadsService } from './uploads.service';

// R2 presigned URL: client upload thẳng file lên R2, xong gọi POST /orders/:id/images với publicUrl.
@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private svc: UploadsService) {}

  @Post('presign')
  presign(@Body() b: { filename: string; contentType: string; folder?: string }) {
    return this.svc.presign(b.filename, b.contentType, b.folder || 'orders');
  }
}
