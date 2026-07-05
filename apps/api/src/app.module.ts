import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// ponytail: skeleton module — auth (JWT + OAuth), performances CRUD, media
// (MinIO) land here per the roadmap once the Docker stack is testable.
@Module({
  controllers: [HealthController],
})
export class AppModule {}
