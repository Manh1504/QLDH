import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  ok() { return { ok: true, service: 'azalas-api', time: new Date().toISOString() }; }
}
