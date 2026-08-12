import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-500 text-lg font-black text-ink-900">
            MK
          </div>
          <h1 className="text-xl font-bold text-white">Master Kitchen</h1>
          <p className="mt-1 text-sm text-ink-400">
            Jobs, pricing, scheduling and invoicing.
          </p>
        </div>

        <form className="card-pad space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/"} />

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="you@masterkitchen.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </div>

          {params.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {params.error}
            </p>
          ) : null}
          {params.message ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {params.message}
            </p>
          ) : null}

          <button formAction={login} className="btn-primary w-full">
            Sign in
          </button>

          <a
            href="/auth/forgot"
            className="block text-center text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </a>

          <p className="text-center text-xs text-ink-500">
            Accounts are created by an owner. Ask them to add you in Settings.
          </p>
        </form>
      </div>
    </main>
  );
}
