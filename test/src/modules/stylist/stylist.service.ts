import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { StylistRequestDto } from './dto/stylist-request.dto';
import { StylistResponseDto } from './dto/stylist-response.dto';
import { GEMINI_CONSTANTS } from '../../common/constants/app.constants';

@Injectable()
export class StylistService {
  private readonly logger = new Logger(StylistService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY chưa được cấu hình trong .env');
    }
    this.genAI = new GoogleGenerativeAI(apiKey ?? '');
  }

  async analyzeAndAdvise(
    humanImage: Express.Multer.File,
    dto: StylistRequestDto,
  ): Promise<StylistResponseDto> {
    this.logger.log(`Phân tích AI Stylist cho trang phục: ${dto.garmentDescription}`);

    const model = this.genAI.getGenerativeModel({ model: GEMINI_CONSTANTS.MODEL });

    const imagePart: Part = {
      inlineData: {
        data: humanImage.buffer.toString('base64'),
        mimeType: humanImage.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
      },
    };

    const prompt = `Bạn là một chuyên gia thời trang cao cấp (Personal Stylist) chuyên về trang phục công sở.

Hãy phân tích bức ảnh người dùng này và tư vấn về trang phục sau:
- Trang phục: ${dto.garmentDescription}
- Dịp mặc: ${dto.occasion ?? 'Công sở chuyên nghiệp'}

Yêu cầu phân tích:
1. Xác định dáng người (bodyType): ví dụ Chữ V, Chữ H, Chữ A, Chữ X...
2. Phân tích màu da (skinTone): tone lạnh/ấm, sáng/tối
3. Xác định Personal Color Season (personalColor): Spring/Summer/Autumn/Winter kèm lý do
4. Tư vấn kiểu dáng (fitRecommendation): slim-fit/regular/relaxed phù hợp với dáng người
5. Đề xuất 3 màu sắc phù hợp (colorSuggestions)
6. Đề xuất 3 bộ outfit hoàn chỉnh (outfitCombinations): bao gồm áo + quần/váy + giày + phụ kiện
7. Mẹo mặc đẹp cụ thể (stylingTips)
8. Nhận xét tổng thể (verdict): trang phục này có phù hợp không và tại sao

Trả về dưới dạng JSON hợp lệ với đúng các key sau (không thêm markdown, chỉ JSON thuần):
{
  "bodyType": "...",
  "skinTone": "...",
  "personalColor": "...",
  "fitRecommendation": "...",
  "colorSuggestions": ["...", "...", "..."],
  "outfitCombinations": ["...", "...", "..."],
  "stylingTips": "...",
  "verdict": "..."
}`;

    try {
      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();

      // Parse JSON - loại bỏ markdown code block nếu có
      const jsonStr = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonStr) as StylistResponseDto;
      this.logger.log('Gemini Vision phân tích thành công');
      return parsed;
    } catch (error: any) {
      this.logger.error(`Lỗi Gemini Vision: ${error.message}`);

      if (error.message?.includes('API_KEY')) {
        throw new HttpException(
          { statusCode: 401, message: 'GEMINI_API_KEY không hợp lệ hoặc chưa cấu hình', error: 'INVALID_API_KEY' },
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new HttpException(
        { statusCode: 500, message: 'Lỗi khi phân tích ảnh bằng AI Stylist', error: 'GEMINI_ERROR', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
