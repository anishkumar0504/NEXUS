import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function Auth() {
  async function login(provider: "google" | "github") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
    })

console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    if (error) {
      console.error(error)
      alert("Error logging in")
    }
  }

  return (
    <div>
      <button onClick={() => login("google")}>
        Login with Google
      </button>
hello

<h1 className="text-3xl font-bold underline">
    hiii
</h1>

      <button onClick={() => login("github")}>
        Login with GitHub
      </button>
    </div>
  )
}