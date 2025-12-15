"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { toast } from "sonner"
import { Loader2, User, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const profileSchema = z.object({
  email: z.string().email("Email tidak valid"),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfileSettings() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      fullName: "",
    },
  })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          // Get profile data
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('user_id', user.id)
            .single() as { data: { full_name: string | null; email: string | null } | null }

          if (profile) {
            form.reset({
              email: profile.email || user.email || "",
              fullName: profile.full_name || "",
            })
          } else {
            form.reset({
              email: user.email || "",
              fullName: "",
            })
          }
        }
      } catch (error) {
        console.error("Error loading profile:", error)
      } finally {
        setIsLoadingProfile(false)
      }
    }

    loadProfile()
  }, [form])

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("User tidak ditemukan")
      }

      // Update profile in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: data.fullName,
          email: data.email,
        } as any)
        .eq('user_id', user.id)

      if (profileError) {
        throw new Error(profileError.message)
      }

      // Update email in auth if changed
      if (data.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email,
        })

        if (emailError) {
          throw new Error(emailError.message)
        }

        toast.success("Profil diperbarui. Silakan verifikasi email baru Anda.")
      } else {
        toast.success("Profil berhasil diperbarui")
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui profil")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingProfile) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <CardTitle>Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <CardTitle>Profil</CardTitle>
        </div>
        <CardDescription>
          Kelola informasi profil akun Anda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        className="pl-9"
                        {...field}
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Email akan digunakan untuk login dan notifikasi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nama lengkap Anda"
                        className="pl-9"
                        {...field}
                        disabled={isLoading}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isLoading}
              >
                Reset
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
