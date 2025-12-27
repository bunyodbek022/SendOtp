import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateAuthDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
