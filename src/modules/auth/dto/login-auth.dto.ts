import { IsString, IsPhoneNumber, IsNotEmpty } from 'class-validator';

export class LoginAuthDto {
  @IsPhoneNumber('UZ')
  phone: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
