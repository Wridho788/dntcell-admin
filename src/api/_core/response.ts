import { NextResponse } from 'next/server'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export function successResponse<T>(data: T, message?: string, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  }, { status })
}

export function errorResponse(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error,
  }, { status })
}

export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 401 })
}

export function forbiddenResponse(message: string = 'Forbidden'): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 403 })
}

export function notFoundResponse(message: string = 'Not found'): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 404 })
}

export function validationErrorResponse(message: string = 'Validation failed'): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 422 })
}

export function serverErrorResponse(message: string = 'Internal server error'): NextResponse<ApiResponse> {
  return NextResponse.json({
    success: false,
    error: message,
  }, { status: 500 })
}
