import { z, ZodSchema } from 'zod'

export function validatePayload<T>(schema: ZodSchema<T>, data: any): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return { success: false, error: messages }
    }
    return { success: false, error: 'Validation failed' }
  }
}

export async function parseRequestBody<T>(request: Request, schema: ZodSchema<T>): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json()
    return validatePayload(schema, body)
  } catch (error) {
    return { success: false, error: 'Invalid JSON payload' }
  }
}
