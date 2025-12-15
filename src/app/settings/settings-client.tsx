"use client";

import { AdminLayout } from "@/components/layout";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { ChangePasswordSettings } from "@/components/settings/change-password-settings";

export function SettingsClient() {
  return (
    <AdminLayout>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Pengaturan</h1>
          <p className="page-description">
            Kelola profil dan preferensi akun Anda
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <ProfileSettings />

          {/* Change Password */}
          <ChangePasswordSettings />
        </div>
      </div>
    </AdminLayout>
  );
}
