import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { SmsService } from 'src/services/smsService';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
@Injectable()
export class AuthService {
  constructor(
    private readonly smsService: SmsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  create(createAuthDto: CreateAuthDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }

  async sendOtp(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const isThrottled = await this.cacheManager.get(`limit_${cleanPhone}`);
    if (isThrottled) {
      throw new BadRequestException(
        "Juda ko'p so'rov yuborildi. Iltimos, 1 daqiqa kuting.",
      );
    }
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      await this.cacheManager.set(`otp_${cleanPhone}`, otpCode, 120000);

      await this.cacheManager.set(`limit_${cleanPhone}`, true, 60000);
      await this.smsService.sendOtp(cleanPhone, otpCode);

      return {
        success: true,
        message: 'Tasdiqlash kodi telefoningizga yuborildi.',
        expiresIn: '2 minutes',
      };
    } catch (error) {
      console.error('OTP yuborishda xatolik:', error);
      throw new InternalServerErrorException(
        'SMS yuborish tizimida xatolik yuz berdi',
      );
    }
  }

  async verifyOtp(phone: string, userCode: string) {
    const cleanPhone = phone.replace(/\D/g, '');

    const savedCode = await this.cacheManager.get<string>(`otp_${cleanPhone}`);

    if (!savedCode) {
      throw new BadRequestException("Kod muddati o'tgan yoki noto'g'ri raqam");
    }
    if (savedCode !== userCode) {
      throw new BadRequestException('Tasdiqlash kodi xato');
    }
    await this.cacheManager.del(`otp_${cleanPhone}`);
    await this.cacheManager.del(`limit_${cleanPhone}`);

    return {
      success: true,
      message: 'Telefon raqamingiz muvaffaqiyatli tasdiqlandi',
    };
  }
}
