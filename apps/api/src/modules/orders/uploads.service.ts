import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function cfg() {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_BASE } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_PUBLIC_BASE) {
    throw new BadRequestException(
      'Chưa cấu hình R2 (R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY/R2_SECRET_KEY/R2_PUBLIC_BASE trong .env). Xem hướng dẫn tạo bucket.',
    );
  }
  return { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_PUBLIC_BASE };
}

@Injectable()
export class UploadsService {
  private client() {
    const c = cfg();
    return new S3Client({
      region: 'auto',
      endpoint: c.R2_ENDPOINT,
      credentials: { accessKeyId: c.R2_ACCESS_KEY, secretAccessKey: c.R2_SECRET_KEY },
    });
  }

  async presign(filename: string, contentType: string, folder = 'orders') {
    const c = cfg();
    if (!contentType.startsWith('image/')) throw new BadRequestException('Chỉ nhận file ảnh');
    const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'anh.jpg';
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safe}`;
    const uploadUrl = await getSignedUrl(
      this.client(),
      new PutObjectCommand({ Bucket: c.R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { key, uploadUrl, publicUrl: `${c.R2_PUBLIC_BASE}/${key}` };
  }
}
