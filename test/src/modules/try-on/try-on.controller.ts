import {
  Controller, Post, Get, HttpCode, HttpStatus,
  Logger, UseInterceptors, UploadedFiles, BadRequestException, Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TryOnService } from './try-on.service';
import { TryOnRequestDto, GarmentCategory } from './dto/try-on-request.dto';

@ApiTags('Virtual Try-On')
@Controller('try-on')
export class TryOnController {
  private readonly logger = new Logger(TryOnController.name);
  constructor(private readonly tryOnService: TryOnService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'AI Virtual Try-On',
    description: `Upload ảnh người + ảnh trang phục → trả về ảnh đã mặc thử.\n\n**garmentCategory:**\n- \`0\` = Áo trên (áo sơ mi, blazer đơn)\n- \`1\` = Quần/Váy\n- \`2\` = Toàn thân (bộ suit đầy đủ, váy liền, jumpsuit)`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['humanImage', 'garmentImage'],
      properties: {
        humanImage: { type: 'string', format: 'binary', description: 'Ảnh người dùng (toàn thân)' },
        garmentImage: { type: 'string', format: 'binary', description: 'Ảnh trang phục cần thử' },
        garmentCategory: {
          type: 'number',
          enum: [0, 1, 2],
          default: 0,
          description: '0=Áo trên | 1=Quần/Váy | 2=Toàn thân (suit/váy liền)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Trả về file ảnh kết quả.' })
  @ApiResponse({ status: 400, description: 'Thiếu file ảnh.' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'humanImage', maxCount: 1 },
      { name: 'garmentImage', maxCount: 1 },
    ]),
  )
  async tryOn(
    @UploadedFiles() files: { humanImage?: Express.Multer.File[]; garmentImage?: Express.Multer.File[] },
    @Body() dto: TryOnRequestDto,
  ) {
    if (!files.humanImage?.[0] || !files.garmentImage?.[0]) {
      throw new BadRequestException('Vui lòng upload đầy đủ: humanImage và garmentImage');
    }

    // Multer trả về string từ form-data, cần parse về number
    const category = dto.garmentCategory !== undefined
      ? Number(dto.garmentCategory)
      : GarmentCategory.UPPER;

    const categoryLabel = ['Áo trên', 'Quần/Váy', 'Toàn thân'][category] ?? 'Áo trên';
    this.logger.log(
      `Try-On: ${files.humanImage[0].originalname} + ${files.garmentImage[0].originalname} | Category: ${categoryLabel}`,
    );

    return this.tryOnService.generateTryOn(
      files.humanImage[0],
      files.garmentImage[0],
      category,
    );
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check Try-On service' })
  health() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Try-On service is running',
      garmentCategories: { 0: 'Upper body', 1: 'Lower body', 2: 'Full body (suit/dress)' },
      timestamp: new Date().toISOString(),
    };
  }
}
