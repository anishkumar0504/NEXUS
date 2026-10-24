export const BACKEND_URL: string = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, ""); // strips a trailing slash so you never get "//groups"