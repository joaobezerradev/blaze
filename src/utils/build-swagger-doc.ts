type SwaggerOperation = {
  summary: string;
  tags?: string[];
  deprecated?: boolean;
  operationId?: string;
  parameters?: RouteParam[];
  requestBody?: {
    content: {
      'application/json': {
        schema: object;
      };
    };
  };
  responses: {
    [key: number]: SwaggerResponse;
  };
  security?: Array<{ BearerAuth: [] }>;
};

type SwaggerResponse = {
  description: string;
  content?: {
    'application/json': SwaggerJSONContent;
  };
};

type SwaggerJSONContent = {
  schema: {
    type: 'object';
    properties: { [key: string]: { type: JSONSchemaType } };
  };
};

export type JSONSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type RouteParam = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  type: JSONSchemaType;
  example?: string | number | boolean | object | [];
};

export type SwaggerParams = {
  summary: string;
  tags?: string[];
  deprecated?: boolean;
  authentication?: boolean;
  operationId?: string;
  input?: object;
  output?: object;
  statusCode?: number;
  contentType?: string;
  errorMapping?: Record<number, { description: string, schema?: object }>;
  routeParams?: RouteParam[];
};

export const buildSwaggerDoc = (params: SwaggerParams): SwaggerOperation => {
  const defaultResponses = buildDefaultResponses(params);
  const customResponses = buildCustomResponses(params);
  const responses = { ...defaultResponses, ...customResponses } as any

  return {
    summary: params.summary,
    tags: params.tags,
    deprecated: params.deprecated,
    operationId: params.operationId,
    parameters: params.routeParams?.length ? params.routeParams : undefined,
    security: params.authentication ? [{ BearerAuth: [] }] : undefined,
    responses
  };
};

const buildDefaultResponses = (params: SwaggerParams) => {
  const statusCode = params.statusCode ?? 200;
  const contentType = params.contentType ?? 'application/json';

  const outputSchema = params.output
    ? { description: 'Success', content: { [contentType]: { schema: params.output } } }
    : { description: 'Success' };

  const notFoundResponse = (params.input && Object.keys(params.input).some(key => key.endsWith('Id') || key === 'id'))
    ? { 404: { description: 'Not Found' } }
    : {};

  const unauthorizedResponse = params.authentication
    ? { 401: { description: 'Unauthorized', content: { [contentType]: { schema: { type: 'object', properties: { errors: { type: 'array', items: { type: 'string' } } } } } } } }
    : {};

  return {
    400: { description: 'Bad Request' },
    403: { description: 'Forbidden' },
    500: { description: 'Internal Server Error' },
    [statusCode]: outputSchema,
    ...notFoundResponse,
    ...unauthorizedResponse
  };
};

const buildCustomResponses = (params: SwaggerParams) => {
  const contentType = params.contentType ?? 'application/json';

  return params.errorMapping
    ? Object.entries(params.errorMapping).reduce((acc, [code, { description, schema }]) => {
      acc[+code] = {
        description,
        content: {
          [contentType]: {
            schema: {
              type: 'object',
              properties: schema ? { errors: { type: 'array', items: schema } } : undefined
            }
          }
        }
      };
      return acc;
    }, {} as { [key: number]: any })
    : {};
};
