import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TryOnService } from './try-on.service';

/**
 * TryOnController - Xử lý các HTTP request liên quan đến virtual try-on
 */
@ApiTags('Try-On')
@Controller('try-on')
export class TryOnController {
  private readonly logger = new Logger(TryOnController.name);

  constructor(private readonly tryOnService: TryOnService) {}

  /**
   * Endpoint xử lý request virtual try-on
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thực hiện AI Virtual Try-On bằng File', description: 'Upload 2 file ảnh (người và áo) để AI xử lý và trả về thẳng ảnh kết quả.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['humanImage', 'garmentImage'],
      properties: {
        humanImage: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh chụp chính diện của người',
        },
        garmentImage: {
          type: 'string',
          format: 'binary',
          description: 'Ảnh quần áo cần thử',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Trả về trực tiếp file ảnh đã xử lý thành công.' })
  @ApiResponse({ status: 400, description: 'Thiếu file ảnh.' })
  @ApiResponse({ status: 500, description: 'Lỗi server hoặc lỗi từ AI.' })
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
      throw new BadRequestException('Vui lòng upload đầy đủ 2 file: humanImage và garmentImage');
    }

    const humanImage = files.humanImage[0];
    const garmentImage = files.garmentImage[0];

    this.logger.log(`Nhận request try-on từ client. Người: ${humanImage.originalname}, Áo: ${garmentImage.originalname}`);

    try {
      // Truyền buffer file xuống service để gọi AI
      const result = await this.tryOnService.generateTryOn(humanImage, garmentImage);
      
      this.logger.log('Trả về ảnh kết quả thành công cho client');
      
      // Phải return trực tiếp StreamableFile để NestJS trả về định dạng file thay vì JSON
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * FIX: Health check endpoint dùng @Get thay vì @Post
   * GET /api/try-on/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Try-On API is running',
      timestamp: new Date().toISOString(),
      gradioSpace: process.env['GRADIO_SPACE'] ?? 'Kwai-Kolors/Kolors-Virtual-Try-On',
    };
  }
}
