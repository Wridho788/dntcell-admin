'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, X, Image as ImageIcon, Move, Loader2, CheckCircle2 } from 'lucide-react'
import { validateImageFile } from '@/lib/storage/image-upload'
import { createClient } from '@/lib/supabase/client'
import { compressImage, formatFileSize } from '@/lib/utils/image-compression'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

interface ImageUploadProps {
  images: Array<{ url: string; file?: File }>
  onImagesChange: (images: Array<{ url: string; file?: File }>) => void
  maxImages?: number
  className?: string
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'compressing' | 'completed' | 'error'
  error?: string
}

export function ImageUpload({ 
  images, 
  onImagesChange, 
  maxImages = 10, // Changed from 5 to 10
  className 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Helper function to upload with timeout and retry
  const uploadWithTimeout = async (
    supabase: any,
    filePath: string,
    file: File,
    timeoutMs = 30000, // 30 seconds timeout
    retries = 2
  ): Promise<{ error: any }> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        abortControllerRef.current = new AbortController()
        const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), timeoutMs)

        console.log(`📤 Upload attempt ${attempt + 1}/${retries + 1}:`, filePath)

        const { error } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            // Add duplex for better streaming support
            ...(file.size > 100000 ? { duplex: 'half' } : {})
          })

        clearTimeout(timeoutId)
        abortControllerRef.current = null

        if (!error) {
          console.log(`✅ Upload successful on attempt ${attempt + 1}`)
          return { error: null }
        }

        if (attempt === retries) {
          return { error }
        }

        console.log(`⚠️ Upload failed, retrying... (${attempt + 1}/${retries})`, error)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.error('❌ Upload timeout after', timeoutMs, 'ms')
          if (attempt === retries) {
            return { error: new Error('Upload timeout - koneksi terlalu lambat') }
          }
          console.log('🔄 Retrying after timeout...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else {
          console.error('❌ Upload error:', err)
          return { error: err }
        }
      }
    }
    return { error: new Error('Upload failed after retries') }
  }

  const handleFileSelect = async (files: FileList) => {
    const remainingSlots = maxImages - images.length
    
    if (files.length > remainingSlots) {
      toast.error(`Maksimal ${maxImages} gambar. Anda bisa upload ${remainingSlots} lagi.`)
      return
    }

    setUploading(true)
    const newImages: Array<{ url: string; file?: File }> = []
    const progressList: UploadProgress[] = []

    // Initialize progress tracking for each file
    for (let i = 0; i < files.length; i++) {
      progressList.push({
        fileName: files[i].name,
        progress: 0,
        status: 'compressing'
      })
    }
    setUploadProgress(progressList)

    console.log('🖼️ Starting image upload process:', files.length, 'files')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const uploadStartTime = Date.now()
        console.log('📁 Processing file:', file.name, formatFileSize(file.size))
        
        // Update progress: validating
        setUploadProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, progress: 10, status: 'compressing' as const } : p
        ))
        
        // Validate file
        const validation = validateImageFile(file)
        if (!validation.valid) {
          toast.error(`${file.name}: ${validation.error}`)
          console.error('❌ File validation failed:', validation.error)
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'error' as const, error: validation.error } : p
          ))
          continue
        }

        try {
          // Update progress: compressing
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, progress: 30, status: 'compressing' as const } : p
          ))
          
          // Compress image before upload
          console.log('🔄 Compressing image:', file.name)
          const compressedFile = await compressImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.8,
            maxSizeKB: 500
          })
          console.log('✅ Compressed:', formatFileSize(file.size), '→', formatFileSize(compressedFile.size))

          // Update progress: uploading
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, progress: 50, status: 'uploading' as const } : p
          ))

          // Upload to Supabase using client
          const supabase = createClient()
          const fileExt = compressedFile.name.split('.').pop()
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 9)
          const fileName = `${timestamp}-${randomStr}.${fileExt}`
          // Use temp folder for images without product ID yet
          const filePath = `temp/${fileName}`

          console.log('☁️ Uploading to Supabase:', filePath, `(${formatFileSize(compressedFile.size)})`)
          console.log('⏱️ Upload timeout: 30 seconds, with 2 retries')
          
          // Use upload with timeout and retry
          const { error: uploadError } = await uploadWithTimeout(
            supabase,
            filePath,
            compressedFile,
            30000, // 30 seconds
            2 // 2 retries
          )

          if (uploadError) {
            console.error('❌ Supabase upload error:', uploadError)
            const errorMsg = uploadError.message || 'Upload failed'
            toast.error(`Gagal upload ${file.name}: ${errorMsg}`)
            setUploadProgress(prev => prev.map((p, idx) => 
              idx === i ? { ...p, status: 'error' as const, error: errorMsg } : p
            ))
            continue
          }

          console.log('✅ Upload successful to path:', filePath)

          // Calculate upload stats
          const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2)
          const uploadSpeed = (compressedFile.size / 1024 / parseFloat(uploadDuration)).toFixed(2)
          console.log(`⚡ Upload stats: ${uploadDuration}s, ${uploadSpeed} KB/s`)

          // Update progress: getting URL
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, progress: 90, status: 'uploading' as const } : p
          ))

          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

          const publicUrl = urlData.publicUrl
          console.log('✅ Public URL generated:', publicUrl)
          
          // Update progress: completed
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, progress: 100, status: 'completed' as const } : p
          ))
          
          newImages.push({
            url: publicUrl,
            file: compressedFile
          })
          
          console.log(`✅ Image ${i + 1}/${files.length} processed successfully`)
        } catch (uploadError) {
          console.error('❌ Upload process error:', uploadError)
          const errorMsg = uploadError instanceof Error ? uploadError.message : 'Unknown error'
          toast.error(`Gagal upload ${file.name}: ${errorMsg}`)
          setUploadProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, status: 'error' as const, error: errorMsg } : p
          ))
          continue
        }
      }

      if (newImages.length > 0) {
        console.log('✅ All uploads completed:', newImages.length, 'images')
        onImagesChange([...images, ...newImages])
        toast.success(`Berhasil upload ${newImages.length} gambar (terkompresi & teroptimasi)`)
      } else {
        console.log('⚠️ No images were uploaded successfully')
        if (files.length > 0) {
          toast.warning('Tidak ada gambar yang berhasil diupload')
        }
      }
    } catch (error) {
      console.error('❌ Upload process failed:', error)
      toast.error('Gagal upload gambar')
    } finally {
      console.log('🏁 Upload process finished, resetting state')
      
      // Cancel any pending uploads
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      
      // Small delay to ensure state updates are flushed
      await new Promise(resolve => setTimeout(resolve, 100))
      setUploading(false)
      // Clear progress after 3 seconds to let users see completion
      setTimeout(() => {
        console.log('🧹 Clearing upload progress display')
        setUploadProgress([])
      }, 3000)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return
    
    const newImages = [...images]
    const [movedImage] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, movedImage)
    onImagesChange(newImages)
  }

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleImageDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveImage(draggedIndex, dropIndex)
    }
    setDraggedIndex(null)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          'border-dashed border-2 cursor-pointer transition-colors',
          images.length >= maxImages 
            ? 'border-muted bg-muted/50 cursor-not-allowed' 
            : 'hover:border-primary/50'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => {
          if (images.length < maxImages) {
            fileInputRef.current?.click()
          } else {
            toast.error(`Maksimal ${maxImages} gambar sudah tercapai`)
          }
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Upload className={cn(
            'h-8 w-8 mb-2',
            images.length >= maxImages ? 'text-muted-foreground/50' : 'text-muted-foreground'
          )} />
          <div className="text-center">
            <p className={cn(
              'text-sm font-medium',
              images.length >= maxImages && 'text-muted-foreground'
            )}>
              {images.length >= maxImages 
                ? 'Batas maksimal gambar tercapai' 
                : 'Drop gambar atau klik untuk browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, WebP hingga 5MB per file
            </p>
            <div className="mt-2">
              <Badge variant={images.length >= maxImages ? 'destructive' : 'secondary'}>
                {images.length}/{maxImages} gambar
              </Badge>
            </div>
          </div>
          {uploading && (
            <div className="mt-3 text-sm text-primary flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={images.length >= maxImages}
        onChange={(e) => {
          if (e.target.files) {
            handleFileSelect(e.target.files)
            // Reset input value to allow selecting the same file again
            e.target.value = ''
          }
        }}
      />

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h4 className="text-sm font-medium">Upload Progress</h4>
            {uploadProgress.map((progress, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate flex-1 mr-2">
                    {progress.fileName}
                  </span>
                  {progress.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  )}
                  {progress.status === 'error' && (
                    <X className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  {progress.status === 'uploading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                  )}
                </div>
                <div className="space-y-1">
                  <Progress 
                    value={progress.progress} 
                    className={cn(
                      'h-2',
                      progress.status === 'error' && 'bg-red-100',
                      progress.status === 'completed' && 'bg-green-100'
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    {progress.status === 'compressing' && 'Mengkompresi gambar...'}
                    {progress.status === 'uploading' && 'Mengupload ke server...'}
                    {progress.status === 'completed' && 'Berhasil!'}
                    {progress.status === 'error' && `Error: ${progress.error}`}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Gambar Produk</h4>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {images.length}/{maxImages}
              </Badge>
              {images.length >= maxImages && (
                <Badge variant="destructive">Penuh</Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((image, index) => (
              <div
                key={`${image.url}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleImageDrop(e, index)}
                className={cn(
                  'relative group cursor-move transition-all',
                  draggedIndex === index && 'opacity-50 scale-95'
                )}
              >
                <Card className="overflow-hidden border-2 hover:border-primary/50 transition-colors">
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={image.url}
                      alt={`Gambar produk ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Primary Badge */}
                    {index === 0 && (
                      <Badge 
                        className="absolute top-2 left-2 bg-blue-600 text-white shadow-lg"
                        variant="default"
                      >
                        Utama
                      </Badge>
                    )}
                    
                    {/* Image Number */}
                    {index > 0 && (
                      <Badge 
                        className="absolute top-2 left-2 bg-black/60 text-white"
                        variant="secondary"
                      >
                        #{index + 1}
                      </Badge>
                    )}
                    
                    {/* Actions Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8 shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(index)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Move Handle */}
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/70 rounded-md p-1.5 shadow-lg">
                          <Move className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
            
            {/* Add More Placeholder (if not at max) */}
            {images.length < maxImages && (
              <div
                className="aspect-square cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Card className="h-full border-2 border-dashed hover:border-primary/50 transition-colors">
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Upload className="h-8 w-8 mb-2" />
                    <p className="text-xs font-medium">Tambah</p>
                  </div>
                </Card>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <ImageIcon className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">Tips Upload Gambar:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Drag gambar untuk mengubah urutan</li>
                <li>Gambar pertama akan menjadi gambar utama</li>
                <li>Maksimal {maxImages} gambar per produk</li>
                <li>Gambar otomatis terkompresi untuk performa optimal</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}