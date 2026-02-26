import VerifyEmailForm from "./components/VerifyEmailForm";
import CheckEmailCard from "./components/CheckEmailCard";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { token } = await searchParams;

  // If token is present, show the verification form (CSR component that will call the API)
  if (token) {
    return <VerifyEmailForm token={token} />;
  }

  // No token - user came here after signup, show "check your email" message
  return <CheckEmailCard />;
}
