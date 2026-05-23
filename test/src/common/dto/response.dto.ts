import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = any> {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Thành công' })
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  constructor(statusCode: number, message: string, data?: T) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message = 'Thành công'): ApiResponseDto<T> {
    return new ApiResponseDto(200, message, data);
  }

  static error(message: string, statusCode = 500): ApiResponseDto<null> {
    return new ApiResponseDto(statusCode, message);
  }
}
