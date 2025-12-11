import { serverErrorResponse } from './response'

export function handleApiError(error: unknown) {
  console.error('API Error:', error)
  
  if (error instanceof Error) {
    return serverErrorResponse(error.message)
  }
  
  return serverErrorResponse('An unexpected error occurred')
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
