import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmsModule } from 'src/services/sms.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [PrismaModule, SmsModule, CacheModule.register({
      ttl: 0, 
      isGlobal: false,
    }),],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
