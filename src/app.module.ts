import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks/tasks.service';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule, ScheduleModule.forRoot(), TasksModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>(`JWT_SECRET`),
        signOptions: {
          expiresIn: '1d',
        },
      }),
      global: true,
    }),
    PrismaModule,
    TasksModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TasksService]
})
export class AppModule {}
