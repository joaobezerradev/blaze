import * as path from 'node:path';
import * as fs from 'node:fs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Request } from '../request';
import { Response } from '../response';
import { HttpServer } from '../server';
import { getContentType } from '../utils/content-type';
import { JSONSchemaType } from '../utils/build-swagger-doc';

export class Swagger {
  private readonly swaggerUiAssetPath: string;

  constructor (
    httpServer: HttpServer,
    private readonly document: Swagger.Document,
    private readonly options: Swagger.Options
  ) {
    this.swaggerUiAssetPath = path.resolve(__dirname, 'swagger-ui');

    httpServer.route('GET', this.options.path, this.serveSwaggerDocs)
    httpServer.route('GET', '/swagger-ui/*', this.serveSwaggerStaticFiles)
  }

  updateSwaggerDoc (method: string, path: string, swaggerData: any): void {
    const swaggerPath = path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    this.document.paths[swaggerPath] = this.document.paths[path] || {};
    this.document.paths[swaggerPath][method.toLowerCase()] = swaggerData;
    writeFileSync('./swagger-ui/swagger.json', JSON.stringify(this.document));
  }

  private async serveSwaggerDocs (req: Request, res: Response): Promise<void> {
    if (req.url === this.options.path) {
      const uiHtml = readFileSync(path.join(this.swaggerUiAssetPath, 'index.html'), 'utf8');
      res.send(uiHtml, 200, { 'Content-Type': 'text/html' });
    } else if (req.url!.startsWith('/swagger-ui') || req.url!.startsWith('/favicon')) {
      const assetPath = path.join(this.swaggerUiAssetPath, req.url!.replace('/swagger-ui', ''));
      if (existsSync(assetPath)) {
        const asset = fs.readFileSync(assetPath)
        const ext = path.extname(req.url!)
        res.send(asset, 200, { 'Content-Type': getContentType(ext) })
      } else {
        res.notFoundError();
      }
    }
  }

  private async serveSwaggerStaticFiles (req: Request, res: Response): Promise<void> {
    const swaggerDir = path.resolve(__dirname, '..', 'swagger-ui')
    const filePath = path.join(swaggerDir, req.url!.replace('/swagger-ui', ''))
    if (existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const fileContent = readFileSync(filePath)
      const ext = path.extname(filePath)
      res.send(fileContent, 200, { 'Content-Type': getContentType(ext) })
    } else {
      res.notFoundError()
    }
  }
}


export namespace Swagger {
  export type Document = {
    [key: string]: any
    description: string,
    version: string,
    title: string,
    termsOfService: string,
    contact: {
      email: string
    },
    license: {
      name: string,
      url: string
    }
  }
  export type Options = { path: string, port: number }
  export type RouteParam = {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    description?: string;
    required?: boolean;
    type: JSONSchemaType
    example?: string | number | boolean | object | []
  }

  export type EndpointConfig = {
    summary: string;
    tags?: string[];
    deprecated?: boolean;
    authentication?: boolean;
    operationId?: string;
    input?: object;
    output?: object;
    statusCode?: number;
    contentType?: string;
    routeParams?: RouteParam[];
  };

}
