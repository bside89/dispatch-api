export class ErrorResponseDto {
  success: false;

  message: string;

  error: string;

  statusCode: number;

  timestamp: string;

  path: string;
}
