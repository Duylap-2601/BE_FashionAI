import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

/**
 * Garment Category cho Kolors Virtual Try-On:
 * 0 = Upper body (Áo trên: áo sơ mi, blazer đơn...)
 * 1 = Lower body (Quần/váy)
 * 2 = Full body  (Toàn thân: bộ suit đầy đủ, váy liền, jumpsuit...)
 */
export enum GarmentCategory {
  UPPER = 0,
  LOWER = 1,
  FULL_BODY = 2,
}

export class TryOnRequestDto {
  @ApiProperty({
    description: 'Loại trang phục để AI xử lý đúng vùng cơ thể',
    enum: GarmentCategory,
    enumName: 'GarmentCategory',
    default: GarmentCategory.UPPER,
    required: false,
    example: 2,
  })
  @IsOptional()
  @IsEnum(GarmentCategory)
  garmentCategory?: GarmentCategory = GarmentCategory.UPPER;
}
