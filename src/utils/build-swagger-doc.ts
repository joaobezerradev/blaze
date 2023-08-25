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

export type JSONSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

type SwaggerJSONContent = {
  schema: {
    type: 'object';
    properties: { [key: string]: { type: JSONSchemaType } };
  };
};

type SwaggerResponse = {
  description: string;
  content?: {
    'application/json': SwaggerJSONContent;
  };
};

export type RouteParam = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  type: JSONSchemaType
  example?: string | number | boolean | object | []
}

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
  routeParams?: RouteParam[];  // Novo campo para parâmetros de rota
};

export const buildSwaggerDoc = (params: SwaggerParams): SwaggerOperation => {
  const statusCode = params.statusCode ?? 200;
  const contentType = params.contentType ?? 'application/json';

  const responses: { [key: number]: any } = params.errorMapping
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
    : {
      400: { description: 'Bad Request' },
      403: { description: 'Forbidden' },
      500: { description: 'Internal Server Error' }
    };

  responses[statusCode] = params.output
    ? {
      description: 'Success',
      content: {
        [contentType]: {
          schema: params.output
        }
      }
    }
    : { description: 'Success' };

  if (params.input && Object.keys(params.input).some(key => key.endsWith('Id') || key === 'id')) {
    responses[404] = { description: 'Not Found' };
  }

  if (params.authentication) {
    responses[401] = { description: 'Unauthorized', content: { [contentType]: { schema: { type: 'object', properties: { errors: { type: 'array', items: { type: 'string' } } } } } } };
  }


  return {
    summary: params.summary,
    tags: params.tags,
    deprecated: params.deprecated,
    operationId: params.operationId,
    responses,
    parameters: params.routeParams?.length ? params.routeParams : undefined,
    security: params.authentication ? [{ BearerAuth: [] }] : undefined
  };
};
