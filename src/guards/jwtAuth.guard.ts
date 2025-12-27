import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header yoq');
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token notogri formatda');
    }
    const isBlacklisted = await this.cacheManager.get(`bl_${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token bekor qilingan');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati tugagan');
    }
  }
}
