# DNTCELL Admin Panel

A modern, secure admin dashboard built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔒 **Secure Authentication** - Admin-only access with role-based permissions
- 🎨 **Modern UI** - Built with Tailwind CSS and Radix UI components
- 🌙 **Dark Mode** - Full dark/light theme support
- 📊 **Dashboard Analytics** - Real-time system monitoring
- 👥 **User Management** - Complete user administration tools
- ⚙️ **Settings Management** - System configuration interface
- 🚀 **Performance Optimized** - TanStack Query for efficient data fetching
- 📱 **Responsive Design** - Mobile-friendly interface

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** Radix UI
- **Database:** Supabase
- **State Management:** TanStack Query + Zustand
- **Authentication:** Supabase Auth
- **Form Handling:** React Hook Form + Zod

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dntcell-admin
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Update the environment variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Next.js Configuration
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret
   
   # Application Configuration
   APP_ENV=development
   APP_NAME="DNTCELL Admin Panel"
   
   # OneSignal Configuration (Optional)
   # Leave empty to skip OneSignal initialization
   NEXT_PUBLIC_ONESIGNAL_APP_ID=your_onesignal_app_id
   ```

4. **Supabase Setup**

   Create the following table in your Supabase database:

   ```sql
   -- Create profiles table
   create table profiles (
     id uuid references auth.users on delete cascade,
     role text default 'user'::text,
     created_at timestamp with time zone default timezone('utc'::text, now()) not null,
     updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
     
     primary key (id)
   );

   -- Enable Row Level Security
   alter table profiles enable row level security;

   -- Create policies
   create policy "Users can view own profile" on profiles
     for select using (auth.uid() = id);

   create policy "Users can update own profile" on profiles
     for update using (auth.uid() = id);

   -- Admin policy (service role)
   create policy "Service role can manage all profiles" on profiles
     using (auth.role() = 'service_role');

   -- Create admin user trigger
   create or replace function public.handle_new_user()
   returns trigger as $$
   begin
     insert into public.profiles (id, role)
     values (new.id, 'user');
     return new;
   end;
   $$ language plpgsql security definer;

   -- Trigger for new user registration
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute procedure public.handle_new_user();
   ```

5. **Create Admin User**

   After setting up the database, create an admin user:
   
   ```sql
   -- Update a user's role to admin
   update profiles set role = 'admin' where id = 'user_uuid_here';
   ```

6. **Run the development server**
   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) with your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Admin dashboard
│   ├── users/            # User management
│   ├── settings/         # System settings
│   ├── login/            # Authentication
│   └── layout.tsx        # Root layout
├── components/           # Reusable components
│   ├── ui/              # Base UI components
│   ├── layout/          # Layout components
│   └── providers/       # Context providers
├── lib/                 # Utility libraries
│   ├── supabase/       # Supabase clients
│   ├── auth/           # Authentication utilities
│   └── utils.ts        # Helper functions
└── middleware.ts       # Auth middleware
```

## Authentication & Authorization

### Middleware Protection

The application uses Next.js middleware to protect admin routes:

- **Public routes:** `/`, `/login`, `/signup`, `/forgot-password`
- **Protected routes:** `/dashboard`, `/users`, `/settings`, etc.

### Role-Based Access

- Only users with `role = 'admin'` in the profiles table can access admin routes
- Non-admin users are redirected to an unauthorized page
- Unauthenticated users are redirected to login

## Available Scripts

```bash
# Development
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

## Environment Variables

Required environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `NEXTAUTH_SECRET` | NextAuth secret for JWT | Yes |
| `NEXTAUTH_URL` | Application base URL | Yes |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | OneSignal App ID for push notifications | No |

**Note:** OneSignal is optional. If `NEXT_PUBLIC_ONESIGNAL_APP_ID` is not configured, the application will skip OneSignal initialization and run without push notifications.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect to Vercel
3. Configure environment variables
4. Deploy

## License

This project is licensed under the MIT License.
