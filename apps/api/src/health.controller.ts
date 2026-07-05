import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  status: 'ok';
  service: 'openstage-api';
  time: string;
}

@Controller('health')
export class HealthController {
  @Get()
  health(): HealthResponse {
    return { status: 'ok', service: 'openstage-api', time: new Date().toISOString() };
  }
}
