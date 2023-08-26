import { ServerResponse } from 'node:http';

export class Response {
  constructor (private readonly serverResponse: ServerResponse) { }

  setResponseHeaders (headers?: Record<string, string>): void {
    if (!headers) return;
    for (const [key, value] of Object.entries(headers)) {
      this.serverResponse.setHeader(key, value);
    }
  }

  private sendResponse (data: any, statusCode: number, contentType?: Response.ContentType): void {
    if (contentType) {
      this.serverResponse.setHeader('Content-Type', contentType);
    }
    this.serverResponse.writeHead(statusCode);
    this.serverResponse.end(data);
  }

  // Success Responses
  // ------------------------------------

  public ok (data: object): void {
    this.json(data, 200);
  }

  public created (data: object): void {
    this.json(data, 201);
  }

  public accepted (): void {
    this.json({ message: 'Accepted' }, 202);
  }

  public noContent (): void {
    this.send('', 204);
  }

  // Client Error Responses
  // ------------------------------------

  public badRequest (message = 'Bad Request'): void {
    this.json({ error: message }, 400);
  }

  public unauthorized (message = 'Unauthorized'): void {
    this.json({ error: message }, 401);
  }

  public forbidden (message = 'Forbidden'): void {
    this.json({ error: message }, 403);
  }

  public notFound (message = 'Not Found'): void {
    this.json({ error: message }, 404);
  }

  public conflict (message = 'Conflict'): void {
    this.json({ error: message }, 409);
  }

  public tooManyRequests (message = 'Too Many Requests'): void {
    this.json({ error: message }, 429);
  }

  // Server Error Responses
  // ------------------------------------

  public internalServerError (error?: Error): void {
    const baseError = { error: 'Internal Server Error' };
    const additionalInfo = error ? { message: error.message, stack: error.stack } : {};
    this.json({ ...baseError, ...additionalInfo }, 500);
  }

  public notImplemented (message = 'Not Implemented'): void {
    this.json({ error: message }, 501);
  }

  public badGateway (message = 'Bad Gateway'): void {
    this.json({ error: message }, 502);
  }

  public serviceUnavailable (message = 'Service Unavailable'): void {
    this.json({ error: message }, 503);
  }

  // General Purpose Methods
  // ------------------------------------

  public json (data: object, statusCode = 200): void {
    this.sendResponse(JSON.stringify(data), statusCode, 'application/json');
  }

  public send (data: any, statusCode = 200, contentType?: Response.ContentType): void {
    try {
      this.sendResponse(data, statusCode, contentType);
    } catch (error) {
      this.internalServerError(error);
    }
  }
}

export namespace Response {
  export type ContentType =
    | 'application/json'
    | 'application/xml'
    | 'application/xhtml+xml'
    | 'application/pdf'
    | 'application/msword'
    | 'application/javascript'
    | 'application/octet-stream'
    | 'audio/mpeg'
    | 'audio/ogg'
    | 'multipart/form-data'
    | 'text/css'
    | 'text/html'
    | 'text/xml'
    | 'text/csv'
    | 'text/plain'
    | 'image/png'
    | 'image/jpeg'
    | 'image/gif';
}
