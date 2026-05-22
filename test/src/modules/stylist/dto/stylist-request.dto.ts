import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class StylistRequestDto {
  @ApiProperty({
    description: 'Loại/màu sắc trang phục mà người dùng chuẩn bị thử',
    example: 'Vest màu Navy Blue, chất liệu wool, kiểu dáng slim-fit',
  })
  @IsNotEmpty()
  @IsString()
  garmentDescription!: string;

  @ApiProperty({
    description: 'Dịp mặc (ví dụ: công sở, dạ tiệc, casual)',
    example: 'Họp quan trọng tại văn phòng',
    required: false,
  })
  @IsOptional()
  @IsString()
  occasion?: string;
}
