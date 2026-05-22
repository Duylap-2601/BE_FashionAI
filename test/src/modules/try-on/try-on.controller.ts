import {
  Controller, Post, Get, HttpCode, HttpStatus,
  Logger, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TryOnService } from './try-on.service';

@ApiTags('Virtual Try-On')
@Controller('try-on')
export class TryOnController {
  private readonly logger = new Logger(TryOnController.name);
  constructor(private readonly tryOnService: TryOnService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI Virtual Try-On', description: 'Upload ảnh người + ảnh áo → trả về ảnh đã mặc thử.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['humanImage', 'garmentImage'],
      properties: {
        humanImage: { type: 'string', format: 'binary', description: 'Ảnh người dùng' },
        garmentImage: { type: 'string', format: 'binary', description: 'Ảnh trang phục cần thử' },
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
  ) {
    if (!files.humanImage?.[0] || !files.garmentImage?.[0]) {
      throw new BadRequestException('Vui lòng upload đầy đủ: humanImage và garmentImage');
    }

    this.logger.log(`Try-On request: ${files.humanImage[0].originalname} + ${files.garmentImage[0].originalname}`);
    return this.tryOnService.generateTryOn(files.humanImage[0], files.garmentImage[0]);
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check Try-On service' })
  health() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Try-On service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
