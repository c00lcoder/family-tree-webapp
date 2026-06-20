import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <SignUp
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
