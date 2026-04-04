import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class BasicAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return this.sendUnauthorized(res);
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    const expectedUsername = this.configService.get('ADMIN_USERNAME');
    const expectedPassword = this.configService.get('ADMIN_PASSWORD');

    if (!expectedUsername || !expectedPassword) {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be configured');
    }

    if (username === expectedUsername && password === expectedPassword) {
      return next();
    }

    return this.sendUnauthorized(res);
  }

  private sendUnauthorized(res: Response) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    res.status(401).json({
      message: 'Authentication required',
      error: 'Unauthorized',
      statusCode: 401,
    });
  }
}
