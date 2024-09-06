import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface ApiResponse {
  statusCode: number;
  body: string;
}

interface HealthResponse {
  message: string;
  version?: string;
  stage?: string;
  error?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const VERSION = process.env.VERSION;
    const STAGE = process.env.STAGE;

    if (!VERSION || !STAGE) {
      throw new Error('Missing environment variables');
    }

    const response: HealthResponse = {
      message: 'Health check successful',
      version: VERSION,
      stage: STAGE,
    };

    return createResponse(200, response);

  } catch (error) {
    const response: HealthResponse = {
      message: 'Health check failed',
      error: (error as Error).message,
    };

    return createResponse(500, response);
  }
};

const createResponse = (statusCode: number, response: HealthResponse): ApiResponse => {
  return {
    statusCode: statusCode,
    body: JSON.stringify(response),
  };
};
