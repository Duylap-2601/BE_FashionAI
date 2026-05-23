import { Injectable, HttpException, HttpStatus, Logger, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import sharp from 'sharp';
import { GRADIO_CONSTANTS } from '../../common/constants/app.constants';

/**
 * TryOnService - Gọi Gradio REST API (Kolors Virtual Try-On)
 *
 * Hỗ trợ 2 chế độ:
 *   1. Single-step: category 0 (upper) hoặc 1 (lower)
 *   2. Two-step:    category 2 (full body) → tự cắt ảnh + gọi Kolors 2 lần
 */
@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);

  private readonly SPACE_BASE_URL: string;
  private readonly HF_TOKEN: string | undefined;
  private readonly TIMEOUT_MS: number;

  constructor(private readonly config: ConfigService) {
    this.SPACE_BASE_URL =
      this.config.get<string>('GRADIO_BASE_URL') ?? GRADIO_CONSTANTS.DEFAULT_BASE_URL;
    this.HF_TOKEN = this.config.get<string>('HF_TOKEN');
    this.TIMEOUT_MS = parseInt(this.config.get<string>('TIMEOUT_MS') ?? '120000', 10);
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.HF_TOKEN) h['Authorization'] = `Bearer ${this.HF_TOKEN}`;
    return h;
  }

  private randomSessionHash(): string {
    return Math.random().toString(36).substring(2, 13);
  }

  // ─── Image Splitting ────────────────────────────────────────────────────────

  /**
   * Cắt phần TRÊN của ảnh suit (60% chiều cao từ trên xuống) để lấy blazer
   */
  private async cropUpperHalf(buffer: Buffer): Promise<Buffer> {
    const meta = await sharp(buffer).metadata();
    const height = meta.height ?? 800;
    const cropHeight = Math.floor(height * 0.62);

    return sharp(buffer)
      .extract({ left: 0, top: 0, width: meta.width ?? 600, height: cropHeight })
      .jpeg({ quality: 95 })
      .toBuffer();
  }

  /**
   * Cắt phần DƯỚI của ảnh suit (55% chiều cao từ giữa xuống) để lấy quần
   * Overlap thêm 10% để đảm bảo không bị mất phần giao thắt lưng
   */
  private async cropLowerHalf(buffer: Buffer): Promise<Buffer> {
    const meta = await sharp(buffer).metadata();
    const height = meta.height ?? 800;
    const topOffset = Math.floor(height * 0.38);
    const cropHeight = height - topOffset;

    return sharp(buffer)
      .extract({ left: 0, top: topOffset, width: meta.width ?? 600, height: cropHeight })
      .jpeg({ quality: 95 })
      .toBuffer();
  }

  // ─── Gradio Upload ──────────────────────────────────────────────────────────

  private async uploadImageToGradio(
    buffer: Buffer,
    filename: string,
    retryCount = 6,
  ): Promise<string> {
    try {
      const form = new FormData();
      form.append('files', new Blob([buffer], { type: 'image/jpeg' }), filename);

      const uploadRes = await fetch(`${this.SPACE_BASE_URL}/upload`, {
        method: 'POST',
        headers: this.headers,
        body: form,
      });

      if (uploadRes.status === 503 || uploadRes.status === 504) {
        throw new Error(`HuggingFace Space đang ngủ (Status: ${uploadRes.status})`);
      }
      if (!uploadRes.ok) throw new Error(`Upload ảnh thất bại: ${uploadRes.status}`);

      const paths = (await uploadRes.json()) as string[];
      return paths[0];
    } catch (e: any) {
      if (retryCount > 0) {
        this.logger.warn(
          `[Cold Start] Thử lại sau ${GRADIO_CONSTANTS.RETRY_DELAY_MS / 1000}s... (còn ${retryCount} lần) - ${e.message}`,
        );
        await new Promise((r) => setTimeout(r, GRADIO_CONSTANTS.RETRY_DELAY_MS));
        return this.uploadImageToGradio(buffer, filename, retryCount - 1);
      }
      throw e;
    }
  }

  // ─── Single Kolors Call ─────────────────────────────────────────────────────

  private async callKolors(
    humanBuffer: Buffer,
    garmentBuffer: Buffer,
    category: number,
    sessionLabel: string,
  ): Promise<Buffer> {
    const sessionHash = this.randomSessionHash();
    this.logger.log(`[${sessionLabel}/${sessionHash}] Upload ảnh...`);

    const [humanPath, garmentPath] = await Promise.all([
      this.uploadImageToGradio(humanBuffer, 'human.jpg'),
      this.uploadImageToGradio(garmentBuffer, 'garment.jpg'),
    ]);

    const joinPayload = {
      data: [
        { meta: { _type: 'gradio.FileData' }, path: humanPath },
        { meta: { _type: 'gradio.FileData' }, path: garmentPath },
        category,
        true,
      ],
      fn_index: 2,
      session_hash: sessionHash,
      event_data: null,
    };

    this.logger.log(`[${sessionLabel}/${sessionHash}] Queue join (category=${category})...`);
    await axios.post(`${this.SPACE_BASE_URL}/queue/join`, joinPayload, {
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const resultUrl = await this.waitForResult(sessionHash);
    this.logger.log(`[${sessionLabel}/${sessionHash}] Nhận kết quả: ${resultUrl}`);

    const imgResponse = await axios.get(resultUrl, { responseType: 'arraybuffer' });
    return Buffer.from(imgResponse.data, 'binary');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async generateTryOn(
    humanImage: Express.Multer.File,
    garmentImage: Express.Multer.File,
    garmentCategory = 0,
  ): Promise<StreamableFile> {
    try {
      let resultBuffer: Buffer;

      if (garmentCategory === 2) {
        // ── 2-STEP: Tự cắt ảnh → apply blazer → apply quần ──
        this.logger.log('Chế độ 2-Step Try-On: đang cắt ảnh suit...');

        const [upperBuffer, lowerBuffer] = await Promise.all([
          this.cropUpperHalf(garmentImage.buffer),
          this.cropLowerHalf(garmentImage.buffer),
        ]);

        this.logger.log('Bước 1/2: Apply blazer (upper body)...');
        const step1Buffer = await this.callKolors(
          humanImage.buffer,
          upperBuffer,
          0, // upper body
          'Step1-Blazer',
        );

        this.logger.log('Bước 2/2: Apply quần (lower body)...');
        resultBuffer = await this.callKolors(
          step1Buffer,
          lowerBuffer,
          1, // lower body
          'Step2-Pants',
        );

        this.logger.log('2-Step Try-On hoàn tất!');
      } else {
        // ── SINGLE-STEP: 0=upper, 1=lower ──
        this.logger.log(`Single-step Try-On (category=${garmentCategory})...`);
        resultBuffer = await this.callKolors(
          humanImage.buffer,
          garmentImage.buffer,
          garmentCategory,
          'SingleStep',
        );
      }

      return new StreamableFile(resultBuffer, {
        type: 'image/jpeg',
        disposition: 'inline; filename="tryon-result.jpg"',
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── SSE Reader ─────────────────────────────────────────────────────────────

  private async waitForResult(sessionHash: string): Promise<string> {
    const sseUrl = `${this.SPACE_BASE_URL}/queue/data?session_hash=${sessionHash}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    const response = await fetch(sseUrl, { headers: this.headers, signal: controller.signal });
    if (!response.ok || !response.body) {
      clearTimeout(timer);
      throw new Error(`SSE thất bại: ${response.status}`);
    }

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event: any;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          this.logger.debug(`SSE: ${event.msg}`);

          if (event.msg === 'process_completed') {
            clearTimeout(timer);
            if (event.success === false) throw new Error(event.output?.error ?? 'AI thất bại');
            const output = event.output?.data?.[0];
            if (!output) throw new Error('AI không trả về ảnh');
            if (typeof output === 'string') return output;
            if (output.url) return output.url as string;
            if (output.path) return `${this.SPACE_BASE_URL}/file=${output.path}`;
            throw new Error(`Không đọc được URL: ${JSON.stringify(output)}`);
          }

          if (event.msg === 'process_errored') {
            clearTimeout(timer);
            throw new Error(event.output?.error ?? 'AI xử lý thất bại');
          }
        }
      }

      clearTimeout(timer);
      throw new Error('SSE kết thúc không có kết quả');
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') throw new Error('Timeout - AI xử lý quá lâu');
      throw err;
    }
  }

  // ─── Error Handler ───────────────────────────────────────────────────────────

  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : 'Lỗi không xác định';
    this.logger.error(`Lỗi Try-On: ${msg}`);

    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
      throw new HttpException({ statusCode: 408, message: 'AI timeout. Thử lại.', error: 'TIMEOUT' }, 408);
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new HttpException({ statusCode: 503, message: 'Không kết nối được AI.', error: 'CONNECTION_FAILED' }, 503);
    }
    throw new HttpException(
      { statusCode: 500, message: 'Lỗi AI virtual try-on', error: 'AI_ERROR', details: msg },
      500,
    );
  }
}
