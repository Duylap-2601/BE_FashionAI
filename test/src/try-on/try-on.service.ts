import { Injectable, HttpException, HttpStatus, Logger, StreamableFile } from '@nestjs/common';
import { Multer } from 'multer';
import axios from 'axios';

/**
 * TryOnService - Gọi Gradio REST API trực tiếp (không dùng @gradio/client)
 *
 * Lý do: @gradio/client là ESM-only package, không tương thích với
 * NestJS CommonJS runtime. Thay bằng gọi HTTP API trực tiếp với axios.
 *
 * Gradio Queue Protocol (dùng cho slow AI models):
 *   1. POST /queue/join  → nhận event_id + session_hash
 *   2. SSE  /queue/data  → stream kết quả đến khi "process_completed"
 */
@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);

  // Space ID → base URL: Kwai-Kolors/Kolors-Virtual-Try-On
  //   → https://kwai-kolors-kolors-virtual-try-on.hf.space
  private readonly SPACE_BASE_URL =
    process.env['GRADIO_BASE_URL'] ??
    'https://kwai-kolors-kolors-virtual-try-on.hf.space';

  private readonly HF_TOKEN = process.env['HF_TOKEN'];
  private readonly TIMEOUT_MS = parseInt(process.env['TIMEOUT_MS'] ?? '120000', 10);

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** Headers chung cho mọi request tới HuggingFace */
  private get headers() {
    const h: Record<string, string> = {};
    if (this.HF_TOKEN) h['Authorization'] = `Bearer ${this.HF_TOKEN}`;
    return h;
  }

  /** Tạo session hash ngẫu nhiên 11 ký tự */
  private randomSessionHash(): string {
    return Math.random().toString(36).substring(2, 13);
  }

  /**
   * Upload thẳng buffer file lên endpoint /upload của Gradio
   * @param buffer Buffer của ảnh
   * @param filename Tên file ảo
   * @returns Đường dẫn path trên server Gradio (ví dụ: /tmp/gradio/xxx/file.jpg)
   */
  private async uploadImageToGradio(buffer: Buffer, filename: string, retryCount = 6): Promise<string> {
    try {
      // 1. Tạo FormData (sử dụng Blob chuẩn của Node >= 18)
      const form = new FormData();
      form.append('files', new Blob([buffer], { type: 'image/jpeg' }), filename);

      // 3. Upload lên Gradio
      const uploadRes = await fetch(`${this.SPACE_BASE_URL}/upload`, {
        method: 'POST',
        headers: this.headers,
        body: form,
      });

      if (uploadRes.status === 503 || uploadRes.status === 504) {
         throw new Error(`Hugging Face Space đang ngủ hoặc quá tải (Status: ${uploadRes.status})`);
      }

      if (!uploadRes.ok) throw new Error(`Upload ảnh lên AI thất bại: ${uploadRes.status}`);
      const paths = (await uploadRes.json()) as string[];
      
      return paths[0]; // Trả về path
    } catch (e: any) {
      if (retryCount > 0) {
        this.logger.warn(`[Cold Start] AI Space có thể đang ngủ, thử lại sau 10s... (còn ${retryCount} lần thử) - Lỗi: ${e.message}`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        return this.uploadImageToGradio(buffer, filename, retryCount - 1);
      }
      this.logger.error(`Lỗi upload ảnh sau nhiều lần thử: ${e.message}`);
      throw e;
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Gọi mô hình AI để thực hiện virtual try-on
   * @param humanImage File ảnh người (phía trước)
   * @param garmentImage File ảnh quần áo
   */
  async generateTryOn(
    humanImage: Express.Multer.File,
    garmentImage: Express.Multer.File,
  ): Promise<StreamableFile> {
    const sessionHash = this.randomSessionHash();

    this.logger.log(
      `[${sessionHash}] Bắt đầu Try-On | người: ${humanImage.originalname} | áo: ${garmentImage.originalname}`,
    );

    try {
      // ── BƯỚC 1: Upload ảnh lên Gradio ──────────────────────────────────────
      this.logger.log(`[${sessionHash}] Đang upload ảnh lên AI Space...`);
      const humanPath = await this.uploadImageToGradio(humanImage.buffer, 'human.jpg');
      const garmentPath = await this.uploadImageToGradio(garmentImage.buffer, 'garment.jpg');

      // ── BƯỚC 2: Join queue ────────────────────────────────────────────────
      const joinUrl = `${this.SPACE_BASE_URL}/queue/join`;

      const joinPayload = {
        data: [
          { meta: { _type: 'gradio.FileData' }, path: humanPath },   // id:11 - Person image
          { meta: { _type: 'gradio.FileData' }, path: garmentPath }, // id:14 - Garment image
          0,                        // id:19 - Seed (slider)
          true,                     // id:20 - Random seed (checkbox)
        ],
        fn_index: 2,                // function index cho try-on
        session_hash: sessionHash,
        event_data: null,
      };

      this.logger.log(`[${sessionHash}] JOIN: POST ${joinUrl}`);
      const joinRes = await axios.post(joinUrl, joinPayload, {
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const eventId: string = joinRes.data?.event_id;
      this.logger.log(`[${sessionHash}] Đã vào queue. event_id: ${eventId}`);

      // ── BƯỚC 3: Đọc SSE stream để lấy kết quả ────────────────────────────
      const resultImageUrl = await this.waitForResult(sessionHash);
      this.logger.log(`[${sessionHash}] Kết quả URL từ AI: ${resultImageUrl}`);

      // ── BƯỚC 4: Tải ảnh kết quả về buffer để trả thẳng cho client ─────────
      this.logger.log(`[${sessionHash}] Đang tải ảnh kết quả về máy chủ...`);
      const imgResponse = await axios.get(resultImageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgResponse.data, 'binary');

      this.logger.log(`[${sessionHash}] Xử lý hoàn tất. Đang trả ảnh về client.`);
      return new StreamableFile(buffer, {
        type: 'image/jpeg',
        disposition: 'inline; filename="tryon-result.jpg"',
      });

    } catch (error) {
      return this.handleError(error);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Đọc SSE stream /queue/data?session_hash=... cho đến khi
   * nhận được event "process_completed" rồi trả về URL ảnh kết quả.
   */
  private async waitForResult(sessionHash: string): Promise<string> {
    const sseUrl = `${this.SPACE_BASE_URL}/queue/data?session_hash=${sessionHash}`;
    this.logger.log(`[${sessionHash}] SSE: GET ${sseUrl}`);

    // Dùng native fetch (Node ≥18) để stream SSE
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    const response = await fetch(sseUrl, {
      headers: this.headers,
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      clearTimeout(timer);
      throw new Error(`SSE stream thất bại: ${response.status} ${response.statusText}`);
    }

    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';   // giữ dòng chưa hoàn chỉnh

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let event: any;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          this.logger.debug(`[${sessionHash}] SSE event: ${event.msg}`);

          // Khi AI xử lý xong
          if (event.msg === 'process_completed') {
            clearTimeout(timer);
            // Log full để debug cấu trúc output
            this.logger.debug(`[${sessionHash}] process_completed full: ${JSON.stringify(event)}`);

            // Kiểm tra lỗi từ phía AI (success = false)
            if (event.success === false) {
              throw new Error(event.output?.error ?? 'AI xử lý thất bại (success=false)');
            }

            const output = event.output?.data?.[0];
            if (!output) throw new Error(`AI không trả về ảnh kết quả. output=${JSON.stringify(event.output)}`);

            // Gradio có thể trả về: string URL, { url } object, hoặc { path }
            if (typeof output === 'string') return output;
            if (output.url) return output.url as string;
            if (output.path) return `${this.SPACE_BASE_URL}/file=${output.path}` as string;
            throw new Error(`Không thể đọc URL từ output: ${JSON.stringify(output)}`);
          }

          // Lỗi từ Gradio
          if (event.msg === 'process_errored') {
            clearTimeout(timer);
            throw new Error(event.output?.error ?? 'AI xử lý thất bại');
          }
        }
      }

      clearTimeout(timer);
      throw new Error('SSE stream kết thúc mà không có kết quả');

    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === 'AbortError') {
        throw new Error('AI processing timeout - mô hình xử lý quá lâu, vui lòng thử lại sau');
      }
      throw err;
    }
  }

  /** Phân loại lỗi và ném HttpException phù hợp */
  private handleError(error: unknown): never {
    const msg = error instanceof Error ? error.message : 'Lỗi không xác định';
    this.logger.error(`Lỗi khi gọi AI: ${msg}`, error);

    if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort')) {
      throw new HttpException(
        { statusCode: HttpStatus.REQUEST_TIMEOUT, message: 'AI processing timeout. Vui lòng thử lại.', error: 'TIMEOUT' },
        HttpStatus.REQUEST_TIMEOUT,
      );
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('Network') || msg.includes('fetch')) {
      throw new HttpException(
        { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: 'Không thể kết nối tới mô hình AI.', error: 'CONNECTION_FAILED' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (msg.toLowerCase().includes('overload') || msg.toLowerCase().includes('busy') || msg.toLowerCase().includes('queue')) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Mô hình AI hiện quá tải. Vui lòng thử lại sau.', error: 'SERVICE_OVERLOADED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    throw new HttpException(
      { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Lỗi khi xử lý AI virtual try-on', error: 'AI_PROCESSING_ERROR', details: msg },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
