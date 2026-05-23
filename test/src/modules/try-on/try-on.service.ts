import { Injectable, HttpException, HttpStatus, Logger, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GRADIO_CONSTANTS } from '../../common/constants/app.constants';

/**
 * TryOnService - Gọi Gradio REST API trực tiếp (không dùng @gradio/client)
 *
 * Gradio Queue Protocol:
 *   1. POST /queue/join  → nhận event_id + session_hash
 *   2. SSE  /queue/data  → stream kết quả đến khi "process_completed"
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
    this.TIMEOUT_MS =
      parseInt(this.config.get<string>('TIMEOUT_MS') ?? '120000', 10);
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.HF_TOKEN) h['Authorization'] = `Bearer ${this.HF_TOKEN}`;
    return h;
  }

  private randomSessionHash(): string {
    return Math.random().toString(36).substring(2, 13);
  }

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

  async generateTryOn(
    humanImage: Express.Multer.File,
    garmentImage: Express.Multer.File,
  ): Promise<StreamableFile> {
    const sessionHash = this.randomSessionHash();
    this.logger.log(`[${sessionHash}] Bắt đầu Try-On`);

    try {
      // BƯỚC 1: Upload ảnh
      this.logger.log(`[${sessionHash}] Uploading ảnh...`);
      const [humanPath, garmentPath] = await Promise.all([
        this.uploadImageToGradio(humanImage.buffer, 'human.jpg'),
        this.uploadImageToGradio(garmentImage.buffer, 'garment.jpg'),
      ]);

      // BƯỚC 2: Join queue
      const joinPayload = {
        data: [
          { meta: { _type: 'gradio.FileData' }, path: humanPath },
          { meta: { _type: 'gradio.FileData' }, path: garmentPath },
          0,
          true,
        ],
        fn_index: 2,
        session_hash: sessionHash,
        event_data: null,
      };

      this.logger.log(`[${sessionHash}] Joining queue...`);
      await axios.post(`${this.SPACE_BASE_URL}/queue/join`, joinPayload, {
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      // BƯỚC 3: Đọc SSE stream
      const resultImageUrl = await this.waitForResult(sessionHash);
      this.logger.log(`[${sessionHash}] Kết quả: ${resultImageUrl}`);

      // BƯỚC 4: Tải ảnh và trả về
      const imgResponse = await axios.get(resultImageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgResponse.data, 'binary');

      return new StreamableFile(buffer, {
        type: 'image/jpeg',
        disposition: 'inline; filename="tryon-result.jpg"',
      });
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async waitForResult(sessionHash: string): Promise<string> {
    const sseUrl = `${this.SPACE_BASE_URL}/queue/data?session_hash=${sessionHash}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    const response = await fetch(sseUrl, {
      headers: this.headers,
      signal: controller.signal,
    });

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

          this.logger.debug(`[${sessionHash}] SSE: ${event.msg}`);

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

  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : 'Lỗi không xác định';
    this.logger.error(`Lỗi Try-On: ${msg}`);

    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('abort')) {
      throw new HttpException({ statusCode: 408, message: 'AI timeout. Thử lại.', error: 'TIMEOUT' }, 408);
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch')) {
      throw new HttpException({ statusCode: 503, message: 'Không kết nối được AI.', error: 'CONNECTION_FAILED' }, 503);
    }

    throw new HttpException(
      { statusCode: 500, message: 'Lỗi AI virtual try-on', error: 'AI_ERROR', details: msg },
      500,
    );
  }
}
