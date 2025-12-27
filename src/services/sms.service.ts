import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly baseUrl = 'https://notify.eskiz.uz/api';
  private token = null;

  constructor(private readonly httpService: HttpService) {}
  async login() {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/auth/login`, {
          email: process.env.ESKIZ_EMAIL,
          password: process.env.ESKIZ_PASSWORD,
        }),
      );
      this.token = response.data.data.token;
      this.logger.log('Eskiz: Yangi token olindi.');
    } catch (error) {
      this.logger.error('Eskiz: Login xatosi', error.response?.data);
      throw new UnauthorizedException('Eskiz xizmatiga ulanib bolmadi');
    }
  }

  async sendOtp(phone: string, code: string) {
    if (!this.token) await this.login();
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/message/sms/send`,
          {
            mobile_phone: phone.replace(/\+/g, ''),
            message: `Fixoo platformasidan ro'yxatdan o'tish uchun tasdiqlash kodi: ${code}. Kodni hech kimga bermang!`,
            from: '4546',
          },
          {
            headers: { Authorization: `Bearer ${this.token}` },
          },
        ),
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.warn('Eskiz: Token muddati otgan, yangilanmoqda...');

        await this.login();

        try {
          return await this.sendOtp(phone, code);
        } catch (retryError) {
          this.logger.error('Eskiz: Ikkinchi urinish ham xato bilan tugadi');
          throw retryError;
        }
      }

      throw error;
    }
  }
}
