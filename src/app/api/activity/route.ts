import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/api/_core/supabase-server";
import { requireAdmin } from "@/api/_core/auth";
import { successResponse, errorResponse } from "@/api/_core/response";
import { handleApiError } from "@/api/_core/error";

// GET /api/activity - Get activity logs (admin only)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if ("userId" in authResult === false) {
      return authResult; // Return error response
    }
    const auth = authResult;

    const { searchParams } = new URL(request.url);

    const adminId = searchParams.get("admin_id");
    const action = searchParams.get("action");
    const negotiationId = searchParams.get("negotiation_id");
    const orderId = searchParams.get("order_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

  let query = supabaseAdmin
  .from('activity_logs')
  .select(`
    id,
    action,
    meta,
    created_at,

    admin:profiles!activity_logs_admin_id_fkey(
      user_id,
      full_name
    )
  `, { count: 'exact' })

    // Fix: Only apply filters if values are not null/empty/all
    if (adminId && adminId !== 'all') {
      query = query.eq("admin_id", adminId);
    }

    if (action && action !== 'all') {
      query = query.eq("action", action);
    }

    if (negotiationId && negotiationId !== 'all') {
      query = query.eq("meta->>negotiation_id", negotiationId);
    }

    if (orderId && orderId !== 'all') {
      query = query.eq("meta->>order_id", orderId);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(error.message);
    }

    return successResponse({
      logs: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
