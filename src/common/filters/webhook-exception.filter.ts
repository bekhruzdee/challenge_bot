import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Catches any exception that escapes the grammY pipeline and reaches NestJS.
 * Always responds 200 so Telegram stops retrying the same update.
 */
@Catch()
export class WebhookExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebhookExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    this.logger.error(
      'Unhandled exception reached NestJS — responding 200 to stop Telegram retries',
      exception instanceof Error ? exception.stack : String(exception),
    );

    const res = host.switchToHttp().getResponse<Response>();
    if (!res.headersSent) {
      res.status(200).send('OK');
    }
  }
}
