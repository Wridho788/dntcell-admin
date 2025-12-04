import * as React from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean
}

const LoadingButton = React.forwardRef<
  HTMLButtonElement,
  LoadingButtonProps
>(({ className, loading, children, disabled, ...props }, ref) => {
  return (
    <Button
      className={cn(className)}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      {children}
    </Button>
  )
})
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }