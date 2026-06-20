import { UserProfile } from "@clerk/nextjs";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold sm:text-3xl">Settings</h1>
      <p className="mt-1 text-muted-foreground">
        Manage your profile and account.
      </p>
      <div className="mt-6">
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
