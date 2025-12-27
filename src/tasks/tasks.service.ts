import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async removeUnverifiedUsers() {
    const result = await this.prisma.user.deleteMany({
      where: {
        isVerified: false,
        createdAt: {
          lt: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
    });

    this.logger.log(
      `O'chirilgan verify bo'lmagan userlar soni: ${result.count}`,
    );
  }
}
