"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { Loader2, CheckCircle, XCircle, DollarSign, Clock } from "lucide-react"

interface ActivityTimelineProps {
  negotiationId: string
}

const ACTION_CONFIG = {
  NEGOTIATION_REQUESTED: { 
    label: "Negotiation Requested", 
    color: "bg-blue-500/10 text-blue-700 border-blue-200",
    icon: DollarSign 
  },
  NEGOTIATION_APPROVED: { 
    label: "Approved", 
    color: "bg-green-500/10 text-green-700 border-green-200",
    icon: CheckCircle 
  },
  NEGOTIATION_COUNTERED: { 
    label: "Counter Offer", 
    color: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    icon: DollarSign 
  },
  NEGOTIATION_REJECTED: { 
    label: "Rejected", 
    color: "bg-red-500/10 text-red-700 border-red-200",
    icon: XCircle 
  },
  DEFAULT: { 
    label: "Action", 
    color: "bg-gray-500/10 text-gray-700 border-gray-200",
    icon: Clock 
  },
} as const

type ActionType = keyof typeof ACTION_CONFIG

function getActionConfig(action: string) {
  return ACTION_CONFIG[action as ActionType] || ACTION_CONFIG.DEFAULT
}

export function ActivityTimeline({ negotiationId }: ActivityTimelineProps) {
  const { data: activities, isLoading, error } = useQuery({
    queryKey: ["activity-logs", "negotiation", negotiationId],
    queryFn: async () => {
      const response = await fetch(`/api/activity?negotiation_id=${negotiationId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch activity logs")
      }
      const result = await response.json()
      return result.data?.logs || []
    },
    staleTime: 30000,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>
          Complete history of admin actions on this negotiation
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 py-4">
            Error loading activity timeline
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            No activity recorded yet
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity: any, index: number) => {
              const config = getActionConfig(activity.action)
              const Icon = config.icon
              const isLast = index === activities.length - 1

              return (
                <div key={activity.id} className="relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-border" />
                  )}

                  {/* Activity item */}
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`shrink-0 w-8 h-8 rounded-full ${config.color} flex items-center justify-center`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                          </div>
                          
                          {/* Admin info */}
                          <div className="text-sm text-muted-foreground">
                            by <span className="font-medium text-foreground">
                              {activity.admin?.full_name || "System"}
                            </span>
                          </div>

                          {/* Note */}
                          {activity.meta?.note && (
                            <div className="text-sm mt-2 p-3 bg-muted rounded-md italic">
                              "{activity.meta.note}"
                            </div>
                          )}

                          {/* Pricing info */}
                          {activity.meta?.pricing_snapshot && (
                            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                              {activity.meta.pricing_snapshot.offer_price && (
                                <div>
                                  Offer: Rp {activity.meta.pricing_snapshot.offer_price.toLocaleString('id-ID')}
                                </div>
                              )}
                              {activity.meta.pricing_snapshot.counter_price && (
                                <div>
                                  Counter: Rp {activity.meta.pricing_snapshot.counter_price.toLocaleString('id-ID')}
                                </div>
                              )}
                              {activity.meta.pricing_snapshot.final_price && (
                                <div className="font-medium text-green-600">
                                  Final: Rp {activity.meta.pricing_snapshot.final_price.toLocaleString('id-ID')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(activity.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
