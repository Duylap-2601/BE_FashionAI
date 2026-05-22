# AI Fashion Try-On API - NestJS

RESTful API cho tính năng AI Fashion Try-On sử dụng NestJS framework và mô hình AI từ Hugging Face (Kolors-Virtual-Try-On).

## 📋 Tính Năng

- ✅ RESTful API endpoint `/api/try-on` cho virtual try-on
- ✅ Tích hợp @gradio/client để gọi mô hình AI Kwai-Kolors/Kolors-Virtual-Try-On
- ✅ Xử lý lỗi toàn diện (timeout, overload, connection failed, etc.)
- ✅ Validation request với class-validator
- ✅ Cấu trúc code rõ ràng: Controller + Service
- ✅ Logging chi tiết với NestJS Logger
- ✅ CORS support
- ✅ TypeScript + Strict Mode

## 🏗️ Cấu Trúc Dự Án

```
src/
├── main.ts                 # Entry point
├── app.module.ts           # App module
└── try-on/
    ├── try-on.controller.ts   # HTTP request handler
    ├── try-on.service.ts      # AI logic & Gradio integration
    ├── try-on.module.ts       # TryOn module
    └── dto/
        └── try-on-request.dto.ts  # Request validation DTO
```

## 🚀 Cài Đặt & Chạy

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Chạy Development Server

```bash
npm run start:dev
```

Server sẽ chạy tại: `http://localhost:3000`

### 3. Build Production

```bash
npm run build
npm run start:prod
```

## 📡 API Endpoints

### POST `/api/try-on`

Thực hiện virtual try-on với ảnh người và ảnh quần áo.

**Request Body:**
```json
{
  "humanImageUrl": "https://example.com/person.jpg",
  "garmentImageUrl": "https://example.com/shirt.jpg"
}
```

**Success Response (200):**
```json
{
  "statusCode": 200,
  "message": "Virtual try-on thành công",
  "data": {
    "resultImageUrl": "https://output-image-url.jpg",
    "status": "success"
  }
}
```

**Error Response Examples:**

- **400 Bad Request** - URL không hợp lệ
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

- **408 Request Timeout** - AI xử lý quá lâu
```json
{
  "statusCode": 408,
  "message": "AI processing timeout - mô hình xử lý quá lâu. Vui lòng thử lại sau.",
  "error": "TIMEOUT"
}
```

- **429 Too Many Requests** - Mô hình quá tải
```json
{
  "statusCode": 429,
  "message": "Mô hình AI hiện quá tải. Vui lòng thử lại sau.",
  "error": "SERVICE_OVERLOADED"
}
```

- **503 Service Unavailable** - Không kết nối được
```json
{
  "statusCode": 503,
  "message": "Không thể kết nối tới mô hình AI. Vui lòng thử lại sau.",
  "error": "CONNECTION_FAILED"
}
```

- **500 Internal Server Error** - Lỗi chung
```json
{
  "statusCode": 500,
  "message": "Lỗi khi xử lý yêu cầu AI virtual try-on",
  "error": "AI_PROCESSING_ERROR",
  "details": "Error message"
}
```

## 📝 Ví Dụ Sử Dụng

### cURL
```bash
curl -X POST http://localhost:3000/api/try-on \
  -H "Content-Type: application/json" \
  -d '{
    "humanImageUrl": "https://example.com/person.jpg",
    "garmentImageUrl": "https://example.com/shirt.jpg"
  }'
```

### Node.js / Fetch
```javascript
const response = await fetch('http://localhost:3000/api/try-on', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    humanImageUrl: 'https://example.com/person.jpg',
    garmentImageUrl: 'https://example.com/shirt.jpg'
  })
});

const data = await response.json();
console.log(data);
```

### Python / Requests
```python
import requests

response = requests.post('http://localhost:3000/api/try-on', json={
    'humanImageUrl': 'https://example.com/person.jpg',
    'garmentImageUrl': 'https://example.com/shirt.jpg'
})

print(response.json())
```

## 🔧 Các Tập Tin Quan Trọng

### [try-on.controller.ts](src/try-on/try-on.controller.ts)
- Xử lý HTTP POST requests
- Validation input với ValidationPipe
- Format response cho client

### [try-on.service.ts](src/try-on/try-on.service.ts)
- Logic chính gọi Gradio AI client
- Timeout handling (2 phút)
- Xử lý lỗi chi tiết (timeout, overload, connection)
- Logging với Logger service

### [try-on-request.dto.ts](src/try-on/dto/try-on-request.dto.ts)
- Validation DTO cho request
- `humanImageUrl` - URL hợp lệ (http/https)
- `garmentImageUrl` - URL hợp lệ (http/https)

## ⚙️ Cấu Hình

### Environment Variables
Tạo file `.env` (nếu cần):
```env
PORT=3000
NODE_ENV=development
```

### Timeout Configuration
Mặc định timeout là **2 phút** (120000ms) cho AI processing. Có thể điều chỉnh tại [try-on.service.ts](src/try-on/try-on.service.ts):
```typescript
private readonly TIMEOUT_MS = 120000; // 2 phút
```

### CORS Configuration
Cấu hình CORS tại [main.ts](src/main.ts). Mặc định cho phép tất cả origins. Cho production, hãy cấu hình specificity:
```typescript
app.enableCors({
  origin: ['https://yourdomain.com'], // Chỉ định domains cụ thể
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
});
```

## 🐛 Xử Lý Lỗi

Service xử lý các loại lỗi:

1. **Timeout** - Nếu AI xử lý quá 2 phút
   - Status: 408
   - Message: "AI processing timeout"

2. **Overloaded** - Nếu mô hình đang quá tải
   - Status: 429
   - Message: "Service overloaded"

3. **Connection Failed** - Nếu không kết nối được Gradio
   - Status: 503
   - Message: "Connection failed"

4. **Invalid Input** - Nếu URL không hợp lệ
   - Status: 400
   - Validation error details

## 📚 Công Nghệ Sử Dụng

- **NestJS 10** - Framework Node.js
- **@gradio/client** - Client để tương tác Gradio Spaces
- **TypeScript 5** - Typed JavaScript
- **class-validator** - Validation decorators
- **class-transformer** - DTO transformation

## 🔗 Tài Liệu Tham Khảo

- [NestJS Documentation](https://docs.nestjs.com/)
- [Gradio Client Docs](https://www.gradio.app/docs/getting_started/02_building_interfaces)
- [Kwai-Kolors Virtual Try-On Space](https://huggingface.co/spaces/Kwai-Kolors/Kolors-Virtual-Try-On)
- [Class Validator](https://github.com/typestack/class-validator)

## 📧 Support

Nếu gặp vấn đề, kiểm tra:
- Logs từ server (terminal)
- Kiểm tra URL ảnh có hợp lệ không
- Kiểm tra kết nối internet
- Kiểm tra mô hình AI có online không

---

**Phiên bản**: 1.0.0  
**Ngày cập nhật**: 2026-05-19
