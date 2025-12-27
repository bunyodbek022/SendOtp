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
import { SmsService } from 'src/services/sms.service';
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
    const cleanPhone = payload.phone.replace(/\D/g, '');
    const existingUser = await this.prisma.user.findUnique({
      where: {
        phone: `+${cleanPhone.startsWith('998') ? cleanPhone : '998' + cleanPhone}`,
      },
    });

    if (existingUser && existingUser.isVerified) {
      throw new BadRequestException(
        "Bu telefon raqam allaqachon ro'yxatdan o'tgan",
      );
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const pendingUser = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      password: hashedPassword,
    };

    await this.sendOtp(cleanPhone, pendingUser);

    return {
      success: true,
      message: 'Tasdiqlash kodi yuborildi',
    };
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

  async sendOtp(phone: string, userData?: any) {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('998')
      ? `+${cleanPhone}`
      : `+998${cleanPhone}`;

    const isThrottled = await this.cacheManager.get(`limit_${formattedPhone}`);
    if (isThrottled) throw new BadRequestException('1 daqiqa kuting');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `otp_${formattedPhone}`;

    try {
      const cacheData = JSON.stringify({
        code: otpCode,
        userData: userData || null,
      });
      await this.cacheManager.set(cacheKey, cacheData, 120000);
      const testCheck = await this.cacheManager.get(cacheKey);
      console.log('HOZIRGINA SAQLANDI:', testCheck);
      await this.cacheManager.set(`limit_${formattedPhone}`, true, 60000);
      await this.smsService.sendOtp(formattedPhone, otpCode);

      return {
        success: true,
        message: 'Tasdiqlash kodi telefoningizga yuborildi.',
        expiresIn: '2 minutes',
      };
    } catch (error: any) {
      console.error(
        'OTP yuborishda xatolik:',
        error.response?.data || error.message,
      );
      throw new InternalServerErrorException(
        'SMS yuborish tizimida xatolik yuz berdi',
      );
    }
  }

  async verifyOtp(phone: string, userCode: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('998')
      ? `+${cleanPhone}`
      : `+998${cleanPhone}`;

    const cacheKey = `otp_${formattedPhone}`;

    const rawData = await this.cacheManager.get<string>(cacheKey);
    console.log('KESHDAN KELDI:', rawData);

    if (!rawData) {
      throw new BadRequestException("Kod topilmadi yoki muddati o'tgan");
    }

    // 2. Stringni ob'ektga aylantiramiz
    let parsedData;
    try {
      parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
      parsedData = rawData;
    }
    if (!parsedData) {
      throw new BadRequestException("Kod muddati o'tgan yoki xato raqam");
    }

    console.log(parsedData.code);
    if (parsedData.code !== userCode) {
      throw new BadRequestException('Tasdiqlash kodi xato');
    }

    let user = await this.prisma.user.findUnique({
      where: { phone: formattedPhone },
    });
    if (!user) {
      if (!parsedData.userData) {
        throw new BadRequestException(
          "Foydalanuvchi ma'lumotlari topilmadi, qaytadan ro'yxatdan o'ting",
        );
      }

      user = await this.prisma.user.create({
        data: {
          phone: formattedPhone,
          isVerified: true,
          firstName: parsedData.userData.firstName,
          lastName: parsedData.userData.lastName,
          password: parsedData.userData.password,
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    await this.cacheManager.del(`otp_${formattedPhone}`);
    await this.cacheManager.del(`limit_${formattedPhone}`);

    return {
      success: true,
      message: 'Telefon raqamingiz muvaffaqiyatli tasdiqlandi',
    };
  }

  async logout(token: string) {
    if (!token) throw new UnauthorizedException('Token mavjud emas');

    try {
      const decoded: any = await this.jwtService.decode(token);
      if (!decoded?.exp) {
        throw new UnauthorizedException('Token yaroqsiz');
      }
      const ttl = decoded.exp * 1000 - Date.now();
      const ttlSeconds = Math.floor(ttl / 1000);

      if (ttlSeconds > 0) {
        await this.cacheManager.set(`bl_${token}`, true, ttlSeconds);
      }

      return {
        success: true,
        message: 'Siz muvaffaqiyatli logout qilindingiz',
      };
    } catch (error) {
      throw new UnauthorizedException('Tokenni logout qilishda xatolik');
    }
  }
}
