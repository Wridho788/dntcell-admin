"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  getCurrentUser,
  isUserAdmin,
} from "@/lib/supabase/server";
import {
  createProductSchema,
  updateProductSchema,
  productSearchSchema,
  bulkProductActionSchema,
  type Product,
  type CreateProductInput,
  type UpdateProductInput,
  type ProductSearch,
} from "@/lib/validations/product";
import { moveImagesToProduct } from "@/lib/storage/image-operations";

// Types for server actions
type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
};

// Helper function to check admin access
const requireAdminAccess = async (): Promise<string> => {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }

  const hasAdminAccess = await isUserAdmin(user.id);
  if (!hasAdminAccess) {
    throw new Error("Admin access required");
  }

  return user.id;
};

// Create product
export async function createProduct(
  data: CreateProductInput
): Promise<ActionResult<Product>> {
  console.log("🚀 CREATE PRODUCT - Starting with data:", {
    ...data,
    images: data.images ? `${data.images.length} images` : "no images",
  });

  try {
    const userId = await requireAdminAccess();
    console.log("✅ User authenticated:", userId);

    // Validate input
    const validationResult = createProductSchema.safeParse(data);
    if (!validationResult.success) {
      console.error("❌ Validation failed:", validationResult.error.flatten());
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      };
    }

    console.log("✅ Data validation successful");

    const supabase = await createServerSupabaseClient();
    const { images, ...productData } = validationResult.data;

    // Ensure user exists in users table (required for foreign key)
    console.log("🔍 Checking if user exists in users table:", userId);
    const { data: existingUser, error: userCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (userCheckError || !existingUser) {
      console.log("⚠️ User not found in users table, creating entry...");
      
      // Get user email from auth
      const { data: authUser } = await supabase.auth.getUser();
      
      // Create user entry
      const { error: createUserError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: authUser?.user?.email || `user-${userId}@example.com`,
          created_at: new Date().toISOString(),
        });

      if (createUserError && createUserError.code !== '23505') { // Ignore duplicate key error
        console.error("❌ Failed to create user:", createUserError);
        return {
          success: false,
          error: `User creation error: ${createUserError.message}`,
        };
      }
      
      console.log("✅ User entry created in users table");
    } else {
      console.log("✅ User exists in users table");
    }

    // DEBUG: Log all keys in productData
    console.log("🔍 Keys in productData:", Object.keys(productData));
    console.log("🔍 Full productData:", JSON.stringify(productData, null, 2));

    // Check for problematic fields
    if ("sell_price" in productData) {
      console.error("❌ ERROR: Found sell_price in productData!");
    }
    if ("selling_price" in productData) {
      console.log("✅ Found selling_price in productData");
    }

    // Explicitly map fields to ensure correct database column names
    // Only include fields that exist in the products table
    const dbProductData: any = {
      name: productData.name,
      description: productData.description,
      base_price: productData.base_price,
      selling_price: productData.selling_price, // NOT sell_price
      negotiable: productData.negotiable,
      condition: productData.condition,
      status: productData.status,
      is_active:
        productData.is_active !== undefined ? productData.is_active : true,
      seller_id: userId || '5345f8da-b756-42b7-958e-567f6aa13b1e',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add optional fields only if they exist
    if (productData.category_id) {
      dbProductData.category_id = productData.category_id;
    }
    if (productData.main_image_url) {
      dbProductData.main_image_url = productData.main_image_url;
    }
    if (productData.details) {
      dbProductData.details = productData.details;
    }

    console.log(
      "📝 Mapped product data to insert:",
      JSON.stringify(dbProductData, null, 2)
    );

    // Create product with seller_id from current user
    // Use explicit column names to avoid any auto-mapping issues
    const { data: product, error } = await supabase
      .from("products")
      .insert([dbProductData]) // Wrap in array to be explicit
      .select("*") // Select all columns explicitly
      .single();

    if (error) {
      console.error("❌ Database error:", error);
      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    }

    if (!product) {
      return {
        success: false,
        error: "Failed to create product",
      };
    }

    console.log("✅ Product created successfully:", product);

    // Cast product to Product type to access properties
    const createdProduct = product as unknown as Product;

    // Handle images if provided
    if (images && images.length > 0) {
      console.log("📸 Processing images:", images.length, "images");

      // Move images from temp folder to product folder
      try {
        const imageUrls = images.map((img) => img.url);
        console.log("🔄 Moving images from temp to product folder...");
        const movedUrls = await moveImagesToProduct(
          imageUrls,
          createdProduct.id!,
          supabase // Pass server Supabase client
        );
        console.log("✅ Images moved successfully");

        // Update main_image_url with the new URL (first image)
        if (movedUrls.length > 0 && movedUrls[0] !== imageUrls[0]) {
          console.log("📝 Updating main_image_url to new location:", movedUrls[0]);
          const { error: updateError } = await supabase
            .from("products")
            .update({ main_image_url: movedUrls[0] })
            .eq("id", createdProduct.id!);

          if (updateError) {
            console.error("❌ Error updating main_image_url:", updateError);
          } else {
            console.log("✅ main_image_url updated successfully");
          }
        }

        // Update image URLs with new paths
        const imageInserts = movedUrls.map((url, index) => ({
          product_id: createdProduct.id!,
          url: url,
          alt_text:
            images[index].alt_text || `${productData.name} image ${index + 1}`,
          is_primary: images[index].is_primary || index === 0,
          sort_order: images[index].sort_order || index,
          created_at: new Date().toISOString(),
        }));

        console.log("📸 Image inserts:", imageInserts);

        const { data: insertedImages, error: imageError } = await supabase
          .from("product_images")
          .insert(imageInserts)
          .select();

        if (imageError) {
          console.error("❌ Image insert error:", imageError);
        } else {
          console.log("✅ Images inserted:", insertedImages);
        }
      } catch (error) {
        console.error("❌ Error moving images:", error);
        // Don't fail product creation if image move fails
        // Fall back to original URLs
        const imageInserts = images.map((img, index) => ({
          product_id: createdProduct.id!,
          url: img.url,
          alt_text: img.alt_text || `${productData.name} image ${index + 1}`,
          is_primary: img.is_primary || index === 0,
          sort_order: img.sort_order || index,
          created_at: new Date().toISOString(),
        }));

        await supabase.from("product_images").insert(imageInserts);
      }
    } else {
      console.log("ℹ️ No images to process");
    }

    revalidatePath("/products");
    console.log("🎉 CREATE PRODUCT - Completed successfully");

    return {
      success: true,
      data: createdProduct,
    };
  } catch (error) {
    console.error("💥 Create product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Update product
export async function updateProduct(
  data: UpdateProductInput
): Promise<ActionResult<Product>> {
  try {
    await requireAdminAccess();

    // Validate input
    const validationResult = updateProductSchema.safeParse(data);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors,
      };
    }

    const supabase = await createServerSupabaseClient();
    const { id, images, ...updateData } = validationResult.data;

    // Update product (seller_id cannot be changed)
    const { data: product, error } = await supabase
      .from("products")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return {
        success: false,
        error: "Failed to update product. Please try again.",
      };
    }

    if (!product) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    // Cast to Product type
    const updatedProduct = product as unknown as Product;

    // Note: Images will be handled separately if needed
    if (images !== undefined) {
      // Delete existing images
      await supabase.from("product_images").delete().eq("product_id", id);

      // Insert new images
      if (images.length > 0) {
        const imageInserts = images.map((img) => ({
          product_id: id,
          url: img.url,
          alt_text: img.alt_text,
          is_primary: img.is_primary,
          created_at: new Date().toISOString(),
        }));

        const { error: imageError } = await supabase
          .from("product_images")
          .insert(imageInserts);

        if (imageError) {
          console.error("Image update error:", imageError);
        }
      }
    }

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return {
      success: true,
      data: updatedProduct,
    };
  } catch (error) {
    console.error("Update product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Delete product
export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdminAccess();

    if (!id || typeof id !== "string") {
      return {
        success: false,
        error: "Invalid product ID",
      };
    }

    const supabase = await createServerSupabaseClient();

    // Delete product (cascade will handle images)
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Database error:", error);
      return {
        success: false,
        error: "Failed to delete product. Please try again.",
      };
    }

    revalidatePath("/products");
    return {
      success: true,
    };
  } catch (error) {
    console.error("Delete product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Get products with search and pagination
export async function getProducts(
  searchParams: ProductSearch
): Promise<
  ActionResult<{ products: Product[]; total: number; totalPages: number }>
> {
  try {
    await requireAdminAccess();

    // Validate search parameters
    const validationResult = productSearchSchema.safeParse(searchParams);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid search parameters",
      };
    }

    const {
      query,
      category_id,
      status,
      condition,
      is_active,
      negotiable,
      min_price,
      max_price,
      sort_by,
      sort_order,
      page,
      limit,
    } = validationResult.data;

    const supabase = await createServerSupabaseClient();
    let queryBuilder = supabase.from("products").select(
      `
        *,
        product_images(*)
      `,
      { count: "exact" }
    );

    // Apply filters
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,description.ilike.%${query}%,sku.ilike.%${query}%`
      );
    }

    if (category_id) {
      queryBuilder = queryBuilder.eq("category_id", category_id);
    }

    if (status) {
      queryBuilder = queryBuilder.eq("status", status);
    }

    if (condition) {
      queryBuilder = queryBuilder.eq("condition", condition);
    }

    if (is_active !== undefined) {
      queryBuilder = queryBuilder.eq("is_active", is_active);
    }

    if (negotiable !== undefined) {
      queryBuilder = queryBuilder.eq("negotiable", negotiable);
    }

    if (min_price !== undefined) {
      queryBuilder = queryBuilder.gte("base_price", min_price);
    }

    if (max_price !== undefined) {
      queryBuilder = queryBuilder.lte("selling_price", max_price);
    }

    // Apply sorting
    queryBuilder = queryBuilder.order(sort_by, {
      ascending: sort_order === "asc",
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error("Database error:", error);
      return {
        success: false,
        error: "Failed to fetch products. Please try again.",
      };
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return {
      success: true,
      data: {
        products: (data || []) as unknown as Product[],
        total: count || 0,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Get products error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Get single product
export async function getProduct(id: string): Promise<ActionResult<Product>> {
  try {
    await requireAdminAccess();

    if (!id || typeof id !== "string") {
      return {
        success: false,
        error: "Invalid product ID",
      };
    }

    const supabase = await createServerSupabaseClient();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `
        *,
        product_images(*)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Database error:", error);
      return {
        success: false,
        error: "Product not found",
      };
    }

    if (!product) {
      return {
        success: false,
        error: "Product not found",
      };
    }

    return {
      success: true,
      data: product as unknown as Product,
    };
  } catch (error) {
    console.error("Get product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Bulk actions
export async function bulkProductAction(actionData: {
  action: string;
  product_ids: string[];
}): Promise<ActionResult> {
  try {
    await requireAdminAccess();

    // Validate input
    const validationResult = bulkProductActionSchema.safeParse(actionData);
    if (!validationResult.success) {
      return {
        success: false,
        error: "Invalid bulk action data",
      };
    }

    const { action, product_ids } = validationResult.data;
    const supabase = await createServerSupabaseClient();

    let updateData: Partial<Product> = {};

    switch (action) {
      case "activate":
        updateData = { status: "available" as const };
        break;
      case "deactivate":
        updateData = { status: "unavailable" as const };
        break;

      case "delete":
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .in("id", product_ids);

        if (deleteError) {
          return {
            success: false,
            error: "Failed to delete products",
          };
        }

        revalidatePath("/products");
        return { success: true };
      default:
        return {
          success: false,
          error: "Invalid action",
        };
    }

    const { error } = await supabase
      .from("products")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .in("id", product_ids);

    if (error) {
      console.error("Bulk action error:", error);
      return {
        success: false,
        error: "Failed to perform bulk action",
      };
    }

    revalidatePath("/products");
    return { success: true };
  } catch (error) {
    console.error("Bulk action error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Duplicate product
export async function duplicateProduct(
  id: string
): Promise<ActionResult<Product>> {
  try {
    await requireAdminAccess();

    // Get original product
    const originalResult = await getProduct(id);
    if (!originalResult.success || !originalResult.data) {
      return {
        success: false,
        error: "Original product not found",
      };
    }

    const original = originalResult.data;

    // Create duplicate with modified name
    const duplicateData: CreateProductInput = {
      ...original,
      name: `${original.name} (Copy)`,
      status: "available",
    };

    // Remove fields that shouldn't be duplicated
    delete (duplicateData as any).id;
    delete (duplicateData as any).created_at;

    return createProduct(duplicateData);
  } catch (error) {
    console.error("Duplicate product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Get a single product by ID with images
 */
export async function getProductById(
  id: string
): Promise<ActionResult<Product>> {
  try {
    if (!id || typeof id !== "string") {
      return {
        success: false,
        error: "Invalid product ID",
      };
    }

    const supabase = await createServerSupabaseClient();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `
        *,
        product_images (
          id,
          url,
          alt_text,
          is_primary,
          sort_order
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching product:", error);
      return { success: false, error: error.message };
    }

    if (!product) {
      return { success: false, error: "Product not found" };
    }

    return { success: true, data: product as unknown as Product };
  } catch (error) {
    console.error("Error in getProductById:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product",
    };
  }
}

/**
 * Submit product for review (draft -> pending_review)
 */
export async function submitProductForReview(
  productId: string
): Promise<ActionResult> {
  try {
    const userId = await requireAdminAccess();
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("products")
      .update({
        status: "pending_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("seller_id", userId);

    if (error) {
      console.error("Submit for review error:", error);
      return { success: false, error: "Failed to submit product for review" };
    }

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    console.error("Submit for review error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Approve product (pending_review -> approved)
 */
export async function approveProduct(productId: string): Promise<ActionResult> {
  try {
    await requireAdminAccess();
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("products")
      .update({
        status: "approved",
        reject_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (error) {
      console.error("Approve product error:", error);
      return { success: false, error: "Failed to approve product" };
    }

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    console.error("Approve product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Reject product with reason (pending_review -> rejected)
 */
export async function rejectProduct(
  productId: string,
  rejectNote: string
): Promise<ActionResult> {
  try {
    if (!rejectNote || rejectNote.trim().length < 10) {
      return {
        success: false,
        error: "Rejection reason must be at least 10 characters",
      };
    }

    await requireAdminAccess();
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("products")
      .update({
        status: "rejected",
        reject_note: rejectNote.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (error) {
      console.error("Reject product error:", error);
      return { success: false, error: "Failed to reject product" };
    }

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    console.error("Reject product error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Change product status back to draft for editing
 */
export async function changeProductToDraft(
  productId: string
): Promise<ActionResult> {
  try {
    const userId = await requireAdminAccess();
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("products")
      .update({
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .eq("seller_id", userId);

    if (error) {
      console.error("Change to draft error:", error);
      return { success: false, error: "Failed to change status to draft" };
    }

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    return { success: true };
  } catch (error) {
    console.error("Change to draft error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
