import AuthGate from "../../components/auth/AuthGate";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;

  return <AuthGate initialMode={params.mode === "register" ? "register" : "login"} />;
}
