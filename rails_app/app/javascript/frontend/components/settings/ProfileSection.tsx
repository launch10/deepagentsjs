import { useState } from "react";
import { useForm } from "@inertiajs/react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { UserCircleIcon, PencilIcon, CheckIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import type { SettingsUser } from "@pages/Settings";

interface ProfileSectionProps {
  user: SettingsUser;
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const initialFirstName = user.first_name || "";
  const initialLastName = user.last_name || "";

  const { data, setData, patch, processing } = useForm({
    user: {
      first_name: initialFirstName,
      last_name: initialLastName,
    },
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const handleSave = () => {
    patch("/settings", {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handleCancel = () => {
    setData({
      user: {
        first_name: initialFirstName,
        last_name: initialLastName,
      },
    });
    setIsEditing(false);
  };

  const handlePasswordCancel = () => {
    setPasswordData({
      current_password: "",
      password: "",
      password_confirmation: "",
    });
    setPasswordError(null);
    setPasswordSuccess(false);
    setIsChangingPassword(false);
  };

  const handlePasswordSubmit = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordData.password !== passwordData.password_confirmation) {
      setPasswordError("New passwords don't match");
      return;
    }

    if (passwordData.password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setIsSubmittingPassword(true);

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

      const response = await fetch("/settings/update_password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          user: passwordData,
        }),
      });

      if (response.ok) {
        setPasswordSuccess(true);
        setPasswordData({
          current_password: "",
          password: "",
          password_confirmation: "",
        });
        setTimeout(() => {
          setIsChangingPassword(false);
          setPasswordSuccess(false);
        }, 2000);
      } else {
        const data = await response.json();
        setPasswordError(data.errors?.join(", ") || "Failed to update password");
      }
    } catch {
      setPasswordError("An error occurred. Please try again.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <Card className="bg-white border-neutral-300 rounded-2xl w-full lg:w-[911px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green-100">
            <UserCircleIcon className="h-4 w-4 text-accent-green-500" />
          </div>
          <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
            Profile
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email (read-only) */}
        <div className="space-y-2 w-full lg:w-[704px]">
          <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
            Email
          </label>
          <div
            className={`flex items-center px-4 py-3 h-10 border rounded-lg ${
              isEditing
                ? "bg-[#F5F5F4] border-[#E5E5E4] cursor-not-allowed"
                : "bg-white border-[#D3D2D0]"
            }`}
          >
            <span
              className={`font-['Plus_Jakarta_Sans'] text-xs ${
                isEditing ? "text-[#96989B]" : "text-[#2E3238]"
              }`}
            >
              {user.email}
            </span>
            {isEditing && <LockClosedIcon className="ml-auto h-4 w-4 text-[#96989B]" />}
          </div>
        </div>

        {/* Name */}
        {isEditing ? (
          <div className="space-y-3 w-full lg:w-[704px]">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
                  First Name
                </label>
                <Input
                  type="text"
                  name="user[first_name]"
                  value={data.user.first_name}
                  onChange={(e) => setData("user", { ...data.user, first_name: e.target.value })}
                  placeholder="First name"
                  className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238] h-10 border-[#D3D2D0] bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
                  Last Name
                </label>
                <Input
                  type="text"
                  name="user[last_name]"
                  value={data.user.last_name}
                  onChange={(e) => setData("user", { ...data.user, last_name: e.target.value })}
                  placeholder="Last name"
                  className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238] h-10 border-[#D3D2D0] bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={processing}
                size="sm"
                className="h-[34px] bg-[#FAFAF9] hover:bg-[#EDEDEC] border border-[#D3D2D0] text-[#2E3238] font-['Plus_Jakarta_Sans'] text-sm font-normal flex items-center justify-center gap-2"
              >
                <CheckIcon className="h-4 w-4" />
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={processing}
                size="sm"
                className="h-[34px] text-[#74767A] hover:text-[#2E3238] hover:bg-transparent font-['Plus_Jakarta_Sans'] text-sm font-normal"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
              Name
            </label>
            <div className="flex items-center gap-3">
              <div className="w-full lg:w-[704px] flex items-center px-4 py-3 h-10 bg-white border border-[#D3D2D0] rounded-lg">
                <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238]">
                  {user.name || "Not set"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                data-testid="edit-profile-button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 h-10 px-2 text-[#2E3238] hover:text-[#2E3238] hover:bg-transparent font-['Plus_Jakarta_Sans'] text-sm font-normal"
              >
                <PencilIcon className="h-4 w-4 text-[#96989B]" />
                Edit
              </Button>
            </div>
          </div>
        )}

        {/* Password */}
        <div className="space-y-2 w-full lg:w-[704px]">
          <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
            Password
          </label>
          {isChangingPassword ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="font-['Plus_Jakarta_Sans'] text-xs text-[#74767A]">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, current_password: e.target.value })
                  }
                  placeholder="Enter current password"
                  className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238] h-10 border-[#D3D2D0] bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-xs text-[#74767A]">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    placeholder="Enter new password"
                    className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238] h-10 border-[#D3D2D0] bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-xs text-[#74767A]">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={passwordData.password_confirmation}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, password_confirmation: e.target.value })
                    }
                    placeholder="Confirm new password"
                    className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238] h-10 border-[#D3D2D0] bg-white"
                  />
                </div>
              </div>
              {passwordError && (
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#D14F34]">{passwordError}</p>
              )}
              {passwordSuccess && (
                <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E9E72]">
                  Password updated successfully
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handlePasswordSubmit}
                  disabled={isSubmittingPassword}
                  size="sm"
                  className="h-[34px] bg-[#FAFAF9] hover:bg-[#EDEDEC] border border-[#D3D2D0] text-[#2E3238] font-['Plus_Jakarta_Sans'] text-sm font-normal flex items-center justify-center gap-2"
                >
                  <CheckIcon className="h-4 w-4" />
                  {isSubmittingPassword ? "Saving..." : "Save Password"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handlePasswordCancel}
                  disabled={isSubmittingPassword}
                  size="sm"
                  className="h-[34px] text-[#74767A] hover:text-[#2E3238] hover:bg-transparent font-['Plus_Jakarta_Sans'] text-sm font-normal"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setIsChangingPassword(true)}
                className="font-['Plus_Jakarta_Sans'] text-sm text-[#5867C4] hover:underline"
              >
                Change Your Password
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
