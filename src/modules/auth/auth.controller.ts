import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { JwtAuthGuard } from 'src/guards/jwtAuth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() payload: CreateAuthDto) {
    return this.authService.register(payload);
  }

  @Post('send-otp')
  async sendOtp(@Body('phone') phone: string) {
    return this.authService.sendOtp(phone);
  }

  @Post('verify-otp')
  async verifyOtp(@Body('phone') phone: string, @Body('code') code: string) {
    return this.authService.verifyOtp(phone, code);
  }

  @Post('login')
  login(@Body() payload: LoginAuthDto) {
    return this.authService.login(payload);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  findOne(@Req() request) {
    const id = request.user.id;
    return this.authService.profile(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  async update(@Req() req, @Body() dto: UpdateAuthDto) {
    const userId = req.user['id'];
    return this.authService.update(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Headers('authorization') authHeader: string) {
    if (!authHeader) throw new UnauthorizedException('Authorization header yoq');

    const token = authHeader.split(' ')[1];
    return this.authService.logout(token);
  }
}
