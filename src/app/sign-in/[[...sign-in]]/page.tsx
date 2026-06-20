import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <SignIn
        appearance={{
          elements: {
            formButtonPrimary:
              "min-h-12 text-base bg-primary hover:opacity-90",
          },
        }}
      />
    </main>
  );
}
