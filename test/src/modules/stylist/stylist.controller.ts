import {
  Controller, Post, Get, HttpCode, HttpStatus,
  Logger, UseInterceptors, UploadedFile, Body, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { StylistService } from './stylist.service';
import { StylistRequestDto } from './dto/stylist-request.dto';
import { StylistResponseDto } from './dto/stylist-response.dto';

@ApiTags('AI Stylist')
@Controller('stylist')
export class StylistController {
  private readonly logger = new Logger(StylistController.name);
  constructor(private readonly stylistService: StylistService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Phân tích Personal Color & Tư vấn trang phục',
    description: 'Upload ảnh người dùng, Gemini Vision sẽ phân tích dáng người, màu da và đề xuất phong cách phù hợp.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['humanImage', 'garmentDescription'],
      properties: {
        humanImage: { type: 'string', format: 'binary', description: 'Ảnh người dùng' },
        garmentDescription: { type: 'string', example: 'Vest Navy Blue slim-fit chất liệu wool' },
        occasion: { type: 'string', example: 'Họp quan trọng tại văn phòng' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Kết quả tư vấn AI Stylist', type: StylistResponseDto })
  @ApiResponse({ status: 400, description: 'Thiếu ảnh hoặc thông tin trang phục' })
  @UseInterceptors(FileInterceptor('humanImage'))
  async analyze(
    @UploadedFile() humanImage: Express.Multer.File,
    @Body() dto: StylistRequestDto,
  ): Promise<StylistResponseDto> {
    if (!humanImage) {
      throw new BadRequestException('Vui lòng upload ảnh người dùng (humanImage)');
    }

    this.logger.log(`Stylist analyze: ${humanImage.originalname}, outfit: ${dto.garmentDescription}`);
    return this.stylistService.analyzeAndAdvise(humanImage, dto);
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check Stylist service' })
  health() {
    return {
      statusCode: HttpStatus.OK,
      message: 'AI Stylist service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
