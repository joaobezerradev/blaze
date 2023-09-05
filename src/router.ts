import type { Swagger } from 'swagger/swagger'

import type { Request } from './request'
import type { Response } from './response'
import type { Blaze } from './server'

export namespace Router {
  export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  export type HandlerInfo = {
    handler: Blaze.RequestHandler
    pattern?: RegExp
    paramNames?: string[]
  }
  export type NodeHandler = Partial<Record<Method, HandlerInfo>>

}

export class Router {
  private readonly root: Node = new Node()
  private readonly routes = new Map<string, Router.NodeHandler>()
  private swagger?: Swagger

  enableSwagger (swagger: Swagger): void {
    this.swagger = swagger
  }

  aggregate (otherRouter: Router): void {
    for (const [key] of otherRouter.routes.entries()) {
      const [method, path] = key.split(':') as [Router.Method, string]

      if (this.routes.has(key)) {
        throw new Error(`Duplicate route found: ${method} ${path}`)
      }

      const handlerInfo = otherRouter.routes.get(key)
      if (handlerInfo?.[method]?.handler) {
        this.register(method, path, handlerInfo[method]!.handler)
      }
    }
  }

  register (method: Router.Method, path: string, requestHandler: Blaze.RequestHandler, swaggerConfig?: Swagger.EndpointConfig): void {
    const segments = this.getPathSegments(path)
    const endpointNode = this.getNodeForSegments(segments)

    if (!endpointNode) return

    if (!endpointNode.handler[method]) {
      endpointNode.handler[method] = { handler: requestHandler }
    } else {
      endpointNode.handler[method]!.handler = requestHandler
    }

    const handlerInfo: Partial<Record<Router.Method, Router.HandlerInfo>> = { [method]: endpointNode.handler[method]! }
    this.routes.set(`${method}:${path}`, handlerInfo)

    if (this.swagger && swaggerConfig) {
      this.swagger.updateSwaggerDoc(method, path, swaggerConfig)
    }
  }

  async route (req: Request, res: Response): Promise<void> {
    const segments = this.getPathSegments(req.url?.split('?')[0] ?? '/')
    const matchingNode = this.getNodeForSegments(segments, false)

    if (!matchingNode) {
      res.notFound()
      return
    }

    const handlerInfo = matchingNode.handler[req.method as Router.Method]
    handlerInfo ? await handlerInfo.handler(req, res) : res.notFound()
  }

  private getPathSegments (path: string): string[] {
    return path.split('/').filter(segment => segment !== '')
  }

  private getNodeForSegments (segments: string[], createIfNotExist: boolean = true): Node | undefined {
    let currentNode = this.root
    for (const segment of segments) {
      if (!currentNode.children[segment] && createIfNotExist) {
        currentNode.children[segment] = new Node()
      }
      currentNode = currentNode.children[segment] ?? undefined

      if (!currentNode) {
        return undefined
      }
    }
    return currentNode
  }
}

class Node {
  children: Record<string, Node> = {}
  handler: Router.NodeHandler = {}

  constructor () {
    // Initialize handlers with default functions
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as Router.Method[]) {
      this.handler[method] = {
        handler: async (_req: Request, _res: Response): Promise<void> => {
          throw new Error(`Function for ${method} not implemented.`)
        }
      }
    }
  }
}
