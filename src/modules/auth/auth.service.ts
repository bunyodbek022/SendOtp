import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { SmsService } from 'src/services/smsService';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginAuthDto } from './dto/login-auth.dto';
@Injectable()
export class AuthService {
  private userInfo: any;
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  async register(payload: CreateAuthDto) {
    try {
      const cleanPhone = payload.phone.replace(/\D/g, '');

      const existingUser = await this.prisma.user.findUnique({
        where: { phone: cleanPhone },
      });

      if (existingUser && existingUser.isVerified) {
        throw new BadRequestException(
          "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
        );
      }

      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(payload.password, 10);
        this.userInfo = {
          ...payload,
          isVerified: false,
          password: hashedPassword,
        };
      }
      await this.sendOtp(cleanPhone);

      return {
        success: true,
        message: 'Tasdiqlash kodi telefoningizga yuborildi',
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('User register qilishda xatolik');
    }
  }

  async login(payload: LoginAuthDto) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { phone: payload.phone },
      });
      if (!existingUser) {
        throw new NotFoundException('User topilmadi');
      }

      if (!existingUser.isVerified) {
        throw new UnauthorizedException(
          'Siz verifikatsiyadan otishingiz kerak',
        );
      }

      const pay = { id: existingUser.id, phone: existingUser.phone };
      const access_token = await this.jwtService.signAsync(pay);

      return {
        success: true,
        message: 'User login successfully',
        token: access_token,
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Login qilshda xatolik');
    }
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return user;
  }

  async update(userId: string, updateAuthDto: UpdateAuthDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: updateAuthDto.firstName,
        lastName: updateAuthDto.lastName,
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: updatedUser,
      message: 'Profil muvaffaqiyatli yangilandi',
    };
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

    const user = await this.prisma.user.create({ data: { ...this.userInfo } });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    await this.cacheManager.del(`otp_${cleanPhone}`);
    await this.cacheManager.del(`limit_${cleanPhone}`);

    return {
      success: true,
      message: 'Telefon raqamingiz muvaffaqiyatli tasdiqlandi',
    };
  }
}
