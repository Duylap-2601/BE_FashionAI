import { IsString, IsUrl, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TryOnRequestDto {
  @ApiProperty({
    description: 'URL ảnh chụp chính diện của người',
    example: 'https://example.com/human.jpg',
  })
  @IsNotEmpty({ message: 'humanImageUrl không được để trống' })
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'humanImageUrl phải là URL hợp lệ' })
  humanImageUrl!: string;

  @ApiProperty({
    description: 'URL ảnh quần áo cần thử',
    example: 'https://example.com/garment.jpg',
  })
  @IsNotEmpty({ message: 'garmentImageUrl không được để trống' })
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'garmentImageUrl phải là URL hợp lệ' })
  garmentImageUrl!: string;
}
