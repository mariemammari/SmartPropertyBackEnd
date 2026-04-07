import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: any = null;

    // Log the full error for debugging
    console.error('[EXCEPTION FILTER] Caught exception:', exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || 'Error';
        details = exceptionResponse as any;
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      if (
        exception.name === 'BSONError' ||
        exception.name === 'CastError' ||
        exception.name === 'ValidationError'
      ) {
        status = HttpStatus.BAD_REQUEST;
      }
      message = exception.message;
      details = {
        name: exception.name,
        message: exception.message,
        stack:
          process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Return detailed error response
    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
      // In development, include full error info
      ...(process.env.NODE_ENV === 'development' && {
        error:
          exception instanceof Error ? exception.message : String(exception),
      }),
    };

    console.error('[EXCEPTION RESPONSE]', errorResponse);

    response.status(status).json(errorResponse);
  }
}
