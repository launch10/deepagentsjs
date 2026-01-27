import { useState } from "react";
import { useForm } from "@inertiajs/react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { UserCircleIcon, PencilIcon, CheckIcon } from "@heroicons/react/24/outline";

interface ProfileSectionProps {
  user: {
    id: number;
    email: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const initialFirstName = user.first_name || "";
  const initialLastName = user.last_name || "";

  const { data, setData, patch, processing } = useForm({
    user: {
      first_name: initialFirstName,
      last_name: initialLastName,
    },
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

  return (
    <Card className="border-[#D3D2D0] rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF5F3]">
            <UserCircleIcon className="h-4 w-4 text-[#375E56]" />
          </div>
          <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
            Profile
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email (read-only) */}
        <div className="space-y-2 max-w-[639px]">
          <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
            Email
          </label>
          <div className="flex items-center px-4 py-3 h-10 bg-white border border-[#D3D2D0] rounded-lg">
            <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238]">{user.email}</span>
          </div>
        </div>

        {/* Name */}
        {isEditing ? (
          <div className="flex items-end gap-1">
            <div className="space-y-2 max-w-[639px] flex-1">
              <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
                Name
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
            <Button
              onClick={handleSave}
              disabled={processing}
              size="sm"
              className="w-[70px] h-[34px] bg-[#FAFAF9] hover:bg-[#EDEDEC] border border-[#D3D2D0] text-[#2E3238] font-['Plus_Jakarta_Sans'] text-sm font-normal flex items-center justify-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={processing}
              size="sm"
              className="w-[70px] h-[34px] text-[#74767A] hover:text-[#2E3238] hover:bg-transparent font-['Plus_Jakarta_Sans'] text-sm font-normal"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="space-y-2 max-w-[639px] flex-1">
              <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
                Name
              </label>
              <div className="flex items-center px-4 py-3 h-10 bg-white border border-[#D3D2D0] rounded-lg">
                <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238]">
                  {user.name || "Not set"}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 h-[34px] px-2 text-[#2E3238] hover:text-[#2E3238] hover:bg-transparent font-['Plus_Jakarta_Sans'] text-sm font-normal"
            >
              <PencilIcon className="h-4 w-4 text-[#96989B]" />
              Edit
            </Button>
          </div>
        )}

        {/* Password */}
        <div className="space-y-2">
          <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#2E3238]">
            Password
          </label>
          <div>
            <a
              href="/users/edit"
              className="font-['Plus_Jakarta_Sans'] text-sm text-[#5867C4] hover:underline"
            >
              Change Your Password
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
