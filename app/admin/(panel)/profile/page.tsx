import { AdminForm } from "@/components/admin/form";
import { profileFields, profileToValues } from "@/lib/admin-forms";
import { requireAdmin } from "@/lib/auth";
import { readProfile } from "@/lib/store";
import { saveProfileAction } from "../../actions";

// Moving between admin pages is not instant either: each page checks the session first (see the panel layout).
export const instant = false;

export default async function ProfileEditor() {
  await requireAdmin();
  const profile = await readProfile();
  return (
    <div className="max-w-[620px]">
      <h1 className="mb-6 text-[24px] font-medium tracking-[-0.015em] text-strong">Profile</h1>
      <AdminForm fields={profileFields} initial={profileToValues(profile)} action={saveProfileAction} submitLabel="Save profile" />
    </div>
  );
}
