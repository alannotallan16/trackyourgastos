import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: { searchParams: { next?: string; registered?: string } }) {
  const notice = searchParams.registered ? "Account created — you can sign in now." : undefined;
  return <LoginForm next={searchParams.next ?? "/dashboard"} notice={notice} />;
}
