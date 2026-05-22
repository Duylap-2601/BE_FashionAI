import { IsString, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho request virtual try-on
 * Xác định cấu trúc payload mà client gửi tới API
 */
export class TryOnRequestDto {
  @ApiProperty({
    description: 'URL ảnh chụp chính diện của người',
    example: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  })
  @IsNotEmpty({ message: 'humanImageUrl không được để trống' })
  @IsString({ message: 'humanImageUrl phải là một chuỗi' })
  @IsUrl(
    { require_protocol: true },
    { message: 'humanImageUrl phải là một URL hợp lệ (http/https)' },
  )
  humanImageUrl!: string;

  @ApiProperty({
    description: 'URL ảnh quần áo (cần thử lên người)',
    example: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
  })
  @IsNotEmpty({ message: 'garmentImageUrl không được để trống' })
  @IsString({ message: 'garmentImageUrl phải là một chuỗi' })
  @IsUrl(
    { require_protocol: true },
    { message: 'garmentImageUrl phải là một URL hợp lệ (http/https)' },
  )
  garmentImageUrl!: string;
}
