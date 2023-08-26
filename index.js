"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Blaze: () => Blaze,
  Request: () => Request,
  Response: () => Response,
  Router: () => Router
});
module.exports = __toCommonJS(src_exports);

// src/server.ts
var import_node_cluster = __toESM(require("node:cluster"));
var import_node_http2 = require("node:http");
var os = __toESM(require("node:os"));

// src/request.ts
var import_node_http = require("node:http");
var Request = class _Request extends import_node_http.IncomingMessage {
  // Construtor privado para instanciar a classe
  constructor(incomingMessage) {
    super(incomingMessage.socket);
    this.params = {};
    this.query = {};
    this.body = {};
    this.user = {};
    Object.assign(this, incomingMessage);
  }
  // Método estático para criar uma nova instância de Request
  static async create(req, res) {
    const request = new _Request(req);
    await request.initialize(req, res);
    return request;
  }
  // Método para inicializar a instância
  async initialize(req, res) {
    await this.parseBodyIfNecessary(req, res);
    this.parseQueryParams(req);
  }
  // Verifica se a análise do corpo da requisição é necessária e a executa, se necessário
  async parseBodyIfNecessary(req, res) {
    if (this.isBodyParsingNecessary(req.method)) {
      await this.parseBody(req, res);
    }
  }
  // Determina se a análise do corpo da requisição é necessária com base no método HTTP
  isBodyParsingNecessary(method) {
    return ["POST", "PUT", "PATCH"].includes(method ?? "");
  }
  // Analisa o corpo da requisição
  async parseBody(req, res) {
    let body = "";
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
  parseQueryParams(req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    this.query = Object.fromEntries(url.searchParams);
  }
};

// src/response.ts
var Response = class {
  constructor(serverResponse) {
    this.serverResponse = serverResponse;
  }
  setResponseHeaders(headers) {
    if (!headers)
      return;
    for (const [key, value] of Object.entries(headers)) {
      this.serverResponse.setHeader(key, value);
    }
  }
  sendResponse(data, statusCode, contentType) {
    if (contentType) {
      this.serverResponse.setHeader("Content-Type", contentType);
    }
    this.serverResponse.writeHead(statusCode);
    this.serverResponse.end(data);
  }
  // Success Responses
  // ------------------------------------
  ok(data) {
    this.json(data, 200);
  }
  created(data) {
    this.json(data, 201);
  }
  accepted() {
    this.json({ message: "Accepted" }, 202);
  }
  noContent() {
    this.send("", 204);
  }
  // Client Error Responses
  // ------------------------------------
  badRequest(message = "Bad Request") {
    this.json({ error: message }, 400);
  }
  unauthorized(message = "Unauthorized") {
    this.json({ error: message }, 401);
  }
  forbidden(message = "Forbidden") {
    this.json({ error: message }, 403);
  }
  notFound(message = "Not Found") {
    this.json({ error: message }, 404);
  }
  conflict(message = "Conflict") {
    this.json({ error: message }, 409);
  }
  tooManyRequests(message = "Too Many Requests") {
    this.json({ error: message }, 429);
  }
  // Server Error Responses
  // ------------------------------------
  internalServerError(error) {
    const baseError = { error: "Internal Server Error" };
    const additionalInfo = error ? { message: error.message, stack: error.stack } : {};
    this.json({ ...baseError, ...additionalInfo }, 500);
  }
  notImplemented(message = "Not Implemented") {
    this.json({ error: message }, 501);
  }
  badGateway(message = "Bad Gateway") {
    this.json({ error: message }, 502);
  }
  serviceUnavailable(message = "Service Unavailable") {
    this.json({ error: message }, 503);
  }
  // General Purpose Methods
  // ------------------------------------
  json(data, statusCode = 200) {
    this.sendResponse(JSON.stringify(data), statusCode, "application/json");
  }
  send(data, statusCode = 200, contentType) {
    try {
      this.sendResponse(data, statusCode, contentType);
    } catch (error) {
      this.internalServerError(error);
    }
  }
};

// src/router.ts
var Router = class {
  constructor() {
    this.routes = {};
  }
  // Register a new route with a request handler
  register(method, path2, requestHandler) {
    const { pattern, paramNames } = this.generatePatternAndParamNames(path2);
    this.routes[`${method}|${pattern}`] = { handler: requestHandler, pattern, paramNames };
  }
  aggregate(otherRouter) {
    this.routes = { ...this.routes, ...otherRouter.routes };
  }
  // Generate RegExp pattern and parameter names for the path
  generatePatternAndParamNames(path2) {
    const paramNames = [];
    let patternStr = "^" + path2.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([a-zA-Z0-9_]+)";
    });
    if (path2.endsWith("/*")) {
      patternStr = patternStr.slice(0, -2) + "(?:/.*)?";
    }
    patternStr += "$";
    return { pattern: new RegExp(patternStr), paramNames };
  }
  // Route the request to the appropriate handler
  async route(req, res) {
    const urlPath = req.url?.split("?")[0] ?? "/";
    if (await this.matchAndHandleRoute(urlPath, req, res)) {
      return;
    }
    res.notFound();
  }
  // Try to match the route and handle it if found
  async matchAndHandleRoute(urlPath, req, res) {
    for (const key in this.routes) {
      const { pattern, paramNames, handler } = this.routes[key];
      const match = pattern.exec(urlPath);
      if (match) {
        this.populateRequestParams(req, match, paramNames);
        await handler(req, res);
        return true;
      }
    }
    return false;
  }
  // Populate request parameters from the URL
  populateRequestParams(req, match, paramNames) {
    req.params = paramNames.reduce((params, paramName, index) => {
      params[paramName] = match[index + 1];
      return params;
    }, {});
  }
};

// src/swagger/swagger.ts
var import_node_fs = require("node:fs");
var path = __toESM(require("node:path"));

// src/utils/content-type.ts
var contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".js": "application/javascript",
  ".jsx": "text/jsx",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".wav": "audio/x-wav",
  ".txt": "text/plain",
  ".csv": "text/csv"
};
var getContentType = (extension) => {
  return contentTypes[extension] || "application/octet-stream";
};

// src/utils/swagger-html.ts
var generateIndexHtml = (port) => {
  return `<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="http://localhost:${port}/swagger-ui/swagger-ui.css" />
    <link rel="stylesheet" type="text/css" href="http://localhost:${port}/swagger-ui/index.css" />
    <link rel="icon" type="image/png" href="http://localhost:${port}/swagger-ui/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="http://localhost:${port}/swagger-ui/favicon-16x16.png" sizes="16x16" />
  </head>

  <body>
    <div id="swagger-ui"></div>
    <script src="http://localhost:${port}/swagger-ui/swagger-ui-bundle.js" charset="UTF-8"> </script>
    <script src="http://localhost:${port}/swagger-ui/swagger-ui-standalone-preset.js" charset="UTF-8"> </script>
    <script src="http://localhost:${port}/swagger-ui/swagger-initializer.js" charset="UTF-8"> </script>
  </body>
</html>
`;
};

// src/swagger/swagger.ts
var Swagger = class {
  constructor(httpServer, document, options) {
    this.document = document;
    this.options = options;
    this.serveSwaggerDocs = async (_req, res) => {
      const uiHtml = generateIndexHtml(this.options.port);
      res.send(uiHtml, 200, "text/html");
    };
    this.serveSwaggerStaticFiles = async (req, res) => {
      const filePath = path.join(this.swaggerUiAssetPath, req.url.replace("/swagger-ui", ""));
      if ((0, import_node_fs.existsSync)(filePath)) {
        const fileContent = (0, import_node_fs.readFileSync)(filePath);
        const ext = path.extname(filePath);
        res.send(fileContent, 200, getContentType(ext));
      } else {
        res.notFound();
      }
    };
    this.swaggerUiAssetPath = path.resolve(__dirname, "..", "..", "swagger-ui");
    httpServer.get(this.options.path, this.serveSwaggerDocs);
    httpServer.get("/swagger-ui/*", this.serveSwaggerStaticFiles);
  }
  // Public Methods
  // -----------------------------
  updateSwaggerDoc(method, routePath, swaggerData) {
    const swaggerPath = this.formatSwaggerPath(routePath);
    this.updateDocumentPaths(swaggerPath, method, swaggerData);
    this.writeDocumentToFile();
  }
  // Private Methods
  // -----------------------------
  formatSwaggerPath(routePath) {
    return routePath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
  }
  updateDocumentPaths(swaggerPath, method, swaggerData) {
    this.document.paths[swaggerPath] = this.document.paths[swaggerPath] || {};
    this.document.paths[swaggerPath][method.toLowerCase()] = swaggerData;
  }
  writeDocumentToFile() {
    const filePath = `${this.swaggerUiAssetPath}/swagger.json`;
    (0, import_node_fs.writeFileSync)(filePath, JSON.stringify(this.document));
  }
};

// src/server.ts
var Blaze = class {
  constructor(options) {
    this.options = options;
    this.middlewares = [];
    this.router = new Router();
    this.errorHandlers = [];
  }
  enableSwagger(params) {
    this.swagger = new Swagger(this, params, { path: "/api-docs", port: this.options.port });
  }
  routeWithMethod(method, path2, handler, swagger) {
    this.router.register(method, path2, handler);
    if (swagger && this.swagger) {
      this.swagger.updateSwaggerDoc(method, path2, swagger);
    }
  }
  async get(path2, handler, swagger) {
    this.routeWithMethod("GET", path2, handler, swagger);
  }
  async post(path2, handler, swagger) {
    this.routeWithMethod("POST", path2, handler, swagger);
  }
  async put(path2, handler, swagger) {
    this.routeWithMethod("PUT", path2, handler, swagger);
  }
  async patch(path2, handler, swagger) {
    this.routeWithMethod("PATCH", path2, handler, swagger);
  }
  async delete(path2, handler, swagger) {
    this.routeWithMethod("DELETE", path2, handler, swagger);
  }
  useMiddleware(middleware) {
    this.middlewares.push(middleware);
  }
  useRouter(router) {
    this.router.aggregate(router);
  }
  useError(handler) {
    this.errorHandlers.push(handler);
  }
  listen(callback) {
    if (import_node_cluster.default.isPrimary) {
      this.setupCluster();
      callback?.();
    } else {
      this.startServer();
    }
  }
  setupCluster() {
    const numCPUs = os.cpus().length;
    for (let i = 0; i < numCPUs; i++) {
      import_node_cluster.default.fork();
    }
    import_node_cluster.default.on("exit", () => import_node_cluster.default.fork());
  }
  // Inicia o servidor HTTP
  startServer() {
    (0, import_node_http2.createServer)(this.handleRequest.bind(this)).listen(this.options.port);
  }
  async handleRequest(req, res) {
    const response = new Response(res);
    const request = await Request.create(req, response);
    await Promise.all(this.middlewares.map(async (middle) => middle(request, response)));
    try {
      await this.router.route(request, response);
    } catch (error) {
      for (const errorHandler of this.errorHandlers) {
        try {
          errorHandler(error, request, response);
        } catch (handlerError) {
          response.internalServerError(handlerError);
        }
      }
      response.internalServerError(error);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Blaze,
  Request,
  Response,
  Router
});
