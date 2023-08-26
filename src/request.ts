import { IncomingMessage } from 'node:http';
import { Response } from './response';

// Classe Request que estende IncomingMessage do Node.js
export class Request<Body = Request.RequestInput, Params = Request.RequestInput, Query = Request.RequestInput, User = Request.RequestInput> extends IncomingMessage {
  public params: Params = {} as Params;
  public query: Query = {} as Query;
  public body: Body = {} as Body;
  public user: User = {} as User;

  // Método estático para criar uma nova instância de Request
  public static async create (req: IncomingMessage, res: Response): Promise<Request> {
    const request = new Request(req);
    await request.initialize(req, res);
    return request;
  }

  // Construtor privado para instanciar a classe
  private constructor (incomingMessage: IncomingMessage) {
    super(incomingMessage.socket);
    Object.assign(this, incomingMessage);
  }

  // Método para inicializar a instância
  private async initialize (req: IncomingMessage, res: Response): Promise<void> {
    await this.parseBodyIfNecessary(req, res);
    this.parseQueryParams(req);
  }

  // Verifica se a análise do corpo da requisição é necessária e a executa, se necessário
  private async parseBodyIfNecessary (req: IncomingMessage, res: Response): Promise<void> {
    if (this.isBodyParsingNecessary(req.method)) {
      await this.parseBody(req, res);
    }
  }

  // Determina se a análise do corpo da requisição é necessária com base no método HTTP
  private isBodyParsingNecessary (method?: string): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(method || '');
  }

  // Analisa o corpo da requisição
  private async parseBody (req: IncomingMessage, res: Response): Promise<void> {
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk.toString();
      }
      this.body = JSON.parse(body);
    } catch (err) {
      res.internalServerError(err);
    }
  }

  // Analisa os parâmetros da consulta
  private parseQueryParams (req: IncomingMessage): void {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    this.query = Object.fromEntries(url.searchParams) as any;
  }
}
export namespace Request {
  // Define um tipo genérico para as entradas de Request
  export type RequestInput = Record<string, any>;
}
