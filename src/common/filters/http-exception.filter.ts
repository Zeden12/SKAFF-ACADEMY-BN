import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors: string[];
  timestamp: string;
  path: string;
}

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
}

/**
 * Normalizes every thrown error (HttpException or otherwise) into a single,
 * consistent JSON error envelope. Stack traces are only ever logged
 * server-side, never returned to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): {
    statusCode: number;
    message: string;
    errors: string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { statusCode: status, message: body, errors: [] };
      }

      const { message, error } = body as HttpExceptionBody;

      if (Array.isArray(message)) {
        return { statusCode: status, message: error ?? 'Validation failed', errors: message };
      }

      return { statusCode: status, message: message ?? exception.message, errors: [] };
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const message =
      !isProduction && exception instanceof Error ? exception.message : 'Internal server error';

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message, errors: [] };
  }
}
