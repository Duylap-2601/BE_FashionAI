# 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

## 📋 Tổng Quan

**AI Fashion Try-On API** là một ứng dụng NestJS cung cấp RESTful API cho tính năng "Virtual Try-On" (thử quần áo ảo).

- **Framework**: NestJS 10.x
- **Runtime**: Node.js (18+)
- **AI Model**: Hugging Face Gradio Space (Kwai-Kolors/Kolors-Virtual-Try-On)
- **Language**: TypeScript 5.x

---

## 💻 Yêu Cầu Hệ Thống

### Bắt buộc:
- **Node.js**: v18 trở lên (hỗ trợ Fetch API & FormData)
- **npm**: v9 trở lên
- **Git**: Để clone repository

### Kiểm tra phiên bản:
```bash
node --version     # v18.0.0+
npm --version      # v9.0.0+
```

### Yêu cầu bên ngoài:
- Kết nối Internet (để gọi Hugging Face Gradio Space)
- Hugging Face Account (tuỳ chọn, để lấy HF_TOKEN cho unlimited requests)

---

## 📥 Bước 1: Clone Repository

```bash
# Clone code về máy
git clone <repository-url>

# Di chuyển vào thư mục dự án
cd test
```

---

## 📦 Bước 2: Cài Đặt Dependencies

```bash
# Cài đặt tất cả dependencies từ package.json
npm install

# Hoặc dùng npm ci (được khuyến khích cho production/CI)
npm ci
```

**Thời gian**: 2-5 phút (tùy thuộc vào tốc độ mạng)

**Cài đặt thành công** sẽ có thư mục `node_modules/` xuất hiện.

---

## ⚙️ Bước 3: Cấu Hình Environment

### 3.1 Tạo file `.env`

Dự án đã có file `.env` mặc định. Kiểm tra nội dung:

```bash
cat .env
```

### 3.2 File `.env` Mặc Định

```env
# Application Configuration
PORT=3000
NODE_ENV=development

# Gradio Space Configuration
GRADIO_SPACE=Kwai-Kolors/Kolors-Virtual-Try-On
GRADIO_BASE_URL=https://kwai-kolors-kolors-virtual-try-on.hf.space
TIMEOUT_MS=120000

# CORS Configuration
CORS_ORIGIN=*

# Hugging Face Token (tuỳ chọn)
HF_TOKEN=your_token_here
```

### 3.3 Giải Thích Các Tham Số

| Tham Số | Ý Nghĩa | Mặc Định | Lưu Ý |
|---------|---------|---------|-------|
| `PORT` | Cổng chạy server | 3000 | Có thể đổi (3001, 8000, ...) |
| `NODE_ENV` | Môi trường | development | Dùng `production` khi deploy |
| `GRADIO_BASE_URL` | URL của AI Space | Kwai-Kolors | **Không thay đổi** |
| `TIMEOUT_MS` | Timeout cho AI (ms) | 120000 (2 phút) | Tăng nếu model chậm |
| `HF_TOKEN` | Token Hugging Face | (empty) | Không bắt buộc, tăng giới hạn request |

### 3.4 Cách Lấy HF_TOKEN (Tuỳ Chọn)

1. Đăng ký tại https://huggingface.co
2. Vào Settings → Access Tokens
3. Tạo token mới (fine-grained)
4. Sao chép token vào `.env`:
   ```env
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxx
   ```

---

## 🏃 Bước 4: Chạy Development Server

### 4.1 Chạy ở chế độ Development (Watch Mode)

```bash
# Tự động reload khi file thay đổi
npm run start:dev
```

**Output thành công**:
```
🚀 AI Fashion Try-On API đang chạy tại: http://localhost:3000
📍 Endpoint: POST http://localhost:3000/api/try-on
📖 Swagger UI: http://localhost:3000/api/docs
```

### 4.2 Chạy ở chế độ Debug

```bash
# Chạy kèm Node debugger
npm run start:debug
```

Sau đó mở VS Code Debug Console và attach debugger.

### 4.3 Chạy Ở Chế Độ Production

```bash
# Build dự án
npm run build

# Chạy phiên bản compiled
npm run start:prod
```

---

## ✅ Bước 5: Kiểm Tra Server Hoạt Động

### 5.1 Health Check (Kiểm Tra Sơ Bộ)

Mở terminal mới, chạy:

```bash
curl http://localhost:3000/api/try-on/health
```

**Response mong đợi**:
```json
{
  "statusCode": 200,
  "message": "Try-On API is running",
  "timestamp": "2024-12-22T10:30:45.123Z",
  "gradioSpace": "Kwai-Kolors/Kolors-Virtual-Try-On"
}
```

### 5.2 Truy Cập Swagger UI

Mở browser và vào:
```
http://localhost:3000/api/docs
```

Bạn sẽ thấy interactive API documentation.

---

## 🧪 Bước 6: Kiểm Tra API Try-On

### 6.1 Dùng Swagger UI

1. Truy cập: `http://localhost:3000/api/docs`
2. Tìm endpoint `POST /api/try-on`
3. Nhấn "Try it out"
4. Upload 2 file ảnh:
   - **humanImage**: Ảnh chụp chính diện của người
   - **garmentImage**: Ảnh quần áo
5. Nhấn "Execute"

### 6.2 Dùng cURL

```bash
curl -X POST http://localhost:3000/api/try-on \
  -F "humanImage=@/path/to/human.jpg" \
  -F "garmentImage=@/path/to/garment.jpg" \
  --output result.jpg
```

### 6.3 Dùng Test Script

Dự án có file test sẵn:

```bash
# Test bằng file ảnh
npx ts-node test-upload.ts

# Test bằng URL
npx ts-node test-api.ts
```

### 6.4 Response Mong Đợi

**Success (200)**:
- Trả về file ảnh JPG (người đã mặc quần áo)
- File được lưu với tên `tryon-result.jpg`

**Error (400)**:
```json
{
  "statusCode": 400,
  "message": "Vui lòng upload đầy đủ 2 file: humanImage và garmentImage",
  "error": "Bad Request"
}
```

**Error (500)**:
```json
{
  "statusCode": 500,
  "message": "Lỗi từ AI Space hoặc timeout"
}
```

---

## 📁 Cấu Trúc Thư Mục

```
test/
├── src/
│   ├── main.ts                 # Entry point (bootstrap NestJS)
│   ├── app.module.ts           # App module chính
│   └── try-on/
│       ├── try-on.controller.ts   # HTTP handler
│       ├── try-on.service.ts      # Business logic + Gradio integration
│       ├── try-on.module.ts       # Module config
│       └── dto/
│           └── try-on-request.dto.ts  # Request validation
│
├── dist/                       # Output khi build (tự động tạo)
├── node_modules/              # Dependencies (tự động cài)
├── package.json               # Project config
├── tsconfig.json              # TypeScript config
├── nest-cli.json              # NestJS CLI config
├── .env                        # Environment variables
├── .env.example               # Environment template
├── ARCHITECTURE.md            # Kiến trúc chi tiết
├── README.md                  # Giới thiệu dự án
└── GETTING_STARTED.md         # File này (hướng dẫn cài đặt)
```

---

## 🔧 Các Lệnh Hữu Ích

```bash
# Cài đặt dependencies
npm install

# Chạy development server (watch mode)
npm run start:dev

# Chạy debug server
npm run start:debug

# Build dự án
npm run build

# Chạy production server
npm run start:prod

# Format code
npm run format

# Lint code
npm run lint

# Chạy test
npm test

# Xóa output build
npm run prebuild
```

---

## 🐛 Troubleshooting

### Lỗi 1: `Error: Cannot find module '@nestjs/core'`

**Nguyên nhân**: Dependencies chưa được cài đặt

**Giải pháp**:
```bash
npm install
npm install @nestjs/core
```

### Lỗi 2: `Port 3000 already in use`

**Nguyên nhân**: Cổng 3000 đã được sử dụng bởi ứng dụng khác

**Giải pháp** (chọn 1 trong 3):

1. **Thay đổi cổng trong `.env`**:
   ```env
   PORT=3001
   ```

2. **Tìm & kết thúc process đang sử dụng cổng** (Windows):
   ```bash
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

3. **Tìm & kết thúc process đang sử dụng cổng** (Mac/Linux):
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

### Lỗi 3: `Hugging Face Space đang ngủ`

**Nguyên nhân**: AI Space không hoạt động (cold start)

**Giải pháp**:
- Hệ thống tự retry 6 lần (mỗi lần delay 10 giây)
- Hoặc tăng `TIMEOUT_MS` trong `.env` lên 180000 (3 phút)

### Lỗi 4: `TIMEOUT: Hugging Face API request timeout`

**Nguyên nhân**: Timeout quá ngắn

**Giải pháp**: Tăng `TIMEOUT_MS` trong `.env`:
```env
TIMEOUT_MS=180000  # 3 phút
```

### Lỗi 5: `Unable to find valid certification path`

**Nguyên nhân**: Sertifikat SSL/TLS không hợp lệ (hiếm)

**Giải pháp** (chỉ dev):
```bash
# Bỏ qua SSL verification (không khuyến khích production)
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run start:dev
```

### Lỗi 6: `Vui lòng upload đầy đủ 2 file`

**Nguyên nhân**: Missing file upload

**Giải pháp**:
- Kiểm tra form data có `humanImage` và `garmentImage`
- Kiểm tra form field names khớp với yêu cầu

---

## 🌐 Endpoints Chính

### Health Check
```
GET /api/try-on/health
```
**Response**: Kiểm tra server có hoạt động không

### Virtual Try-On (File Upload)
```
POST /api/try-on
Content-Type: multipart/form-data

Body:
- humanImage: File (JPG/PNG)
- garmentImage: File (JPG/PNG)
```
**Response**: JPG file (ảnh kết quả)

### Swagger Documentation
```
GET /api/docs
```
**Response**: Interactive API docs

---

## 📊 Flow Xử Lý

```
1. Client gửi 2 ảnh
           ↓
2. Server validate ảnh
           ↓
3. Upload ảnh lên Hugging Face
           ↓
4. Gửi request tới AI model (Kolors-VTO)
           ↓
5. Chờ AI xử lý (thông qua SSE stream)
           ↓
6. AI trả về URL ảnh kết quả
           ↓
7. Download ảnh từ AI
           ↓
8. Trả về ảnh cho client
```

---

## ✨ Tips & Best Practices

### 1. **Phát Triển (Development)**
```bash
# Sử dụng watch mode để tự động reload
npm run start:dev

# Mở VS Code, file sẽ được reload khi save
```

### 2. **Kiểm Thử (Testing)**
```bash
# Dùng Swagger UI: http://localhost:3000/api/docs
# Hoặc dùng curl/postman

# Kiểm tra ảnh sau khi download
# Phải là file JPG hợp lệ
```

### 3. **Performance**
- Ảnh nhập vào: tối đa ~5MB
- Thời gian xử lý: 30-120 giây (tùy AI Load)
- Khuyến khích dùng HF_TOKEN để tăng giới hạn requests

### 4. **Production Deployment**
```bash
# 1. Build
npm run build

# 2. Cài prod dependencies
npm install --production

# 3. Chạy compiled code
npm run start:prod
```

### 5. **Monitoring Logs**
Xem output của NestJS Logger:
```
[TryOnService] Bắt đầu Try-On
[TryOnService] Đang upload ảnh...
[TryOnService] JOIN: POST /queue/join
[TryOnService] Kết quả URL từ AI: ...
[TryOnService] Xử lý hoàn tất
```

---

## 📚 Tài Liệu Thêm

- **ARCHITECTURE.md**: Kiến trúc chi tiết & flow
- **README.md**: Tổng quan dự án
- **Swagger UI**: http://localhost:3000/api/docs (khi chạy)
- **NestJS Docs**: https://docs.nestjs.com

---

## 🎯 Quickstart (Tóm Tắt 1 Phút)

```bash
# 1. Clone & vào thư mục
git clone <repo> && cd test

# 2. Cài dependencies
npm install

# 3. Chạy dev server
npm run start:dev

# 4. Mở browser
# http://localhost:3000/api/docs

# 5. Upload ảnh thông qua Swagger UI
```

---

## ❓ FAQ

**Q: Có thể chạy mà không cần HF_TOKEN không?**
A: Có, nhưng có giới hạn requests/ngày. Khuyến khích lấy token.

**Q: AI model chậm không?**
A: AI model mất 30-120s tùy CPU load. Timeout mặc định 120s là đủ.

**Q: Có thể dùng model AI khác không?**
A: Có thể, thay đổi `GRADIO_BASE_URL` trong `.env`

**Q: Làm sao để deploy lên production?**
A: Build & chạy `npm run start:prod`. Có thể dùng PM2/Docker.

**Q: Có unit test không?**
A: Chưa có. Có thể thêm bằng @nestjs/testing.

---

**Chúc bạn thành công! 🎉**

Nếu gặp vấn đề, kiểm tra logs terminal để debug.
