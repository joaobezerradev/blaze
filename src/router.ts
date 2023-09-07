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
    let currentNode = this.root

    for (const segment of segments) {
      let nextNode = currentNode.children[segment]

      // Dynamic segment logic
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1)
        if (!currentNode.dynamicChild || currentNode.dynamicChild.param !== paramName) {
          currentNode.dynamicChild = { param: paramName, node: new Node() }
        }
        nextNode = currentNode.dynamicChild.node
      } else if (!nextNode) {
        nextNode = new Node()
        currentNode.children[segment] = nextNode
      }

      currentNode = nextNode
    }

    // Save the handler to the node
    currentNode.handler[method] = { handler: requestHandler }

    // Update routes map
    const handlerInfo: Partial<Record<Router.Method, Router.HandlerInfo>> = { [method]: currentNode.handler[method]! }
    this.routes.set(`${method}:${path}`, handlerInfo)

    // Update Swagger documentation if enabled and provided
    if (this.swagger && swaggerConfig) {
      this.swagger.updateSwaggerDoc(method, path, swaggerConfig)
    }
  }

  async route (req: Request, res: Response): Promise<void> {
    const segments = this.getPathSegments(req.url?.split('?')[0] ?? '/')
    const result = this.getNodeForSegments(segments, false)

    if (!result) {
      res.notFound()
      return
    }

    req.params = { ...req.params, ...result.params } // Merge existing params with new ones

    const handlerInfo = result.node.handler[req.method as Router.Method]
    handlerInfo ? await handlerInfo.handler(req, res) : res.notFound()
  }

  private getPathSegments (path: string): string[] {
    return path.split('/').filter(segment => segment !== '')
  }

  private getNodeForSegments (segments: string[], createIfNotExist: boolean = true): { node: Node, params: Record<string, string> } | undefined {
    let currentNode = this.root
    const params: Record<string, string> = {}

    for (const segment of segments) {
      let nextNode = currentNode.children[segment]

      if (!nextNode && currentNode.dynamicChild) {
        params[currentNode.dynamicChild.param] = segment
        nextNode = currentNode.dynamicChild.node
      } else if (!nextNode && createIfNotExist) {
        if (segment.startsWith(':')) {
          currentNode.dynamicChild = { param: segment.slice(1), node: new Node() }
          nextNode = currentNode.dynamicChild.node
        } else {
          nextNode = new Node()
          currentNode.children[segment] = nextNode
        }
      }

      currentNode = nextNode || undefined

      if (!currentNode) {
        return undefined
      }
    }

    return { node: currentNode, params }
  }
}

class Node {
  children: Record<string, Node> = {}
  dynamicChild?: { param: string, node: Node }
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
