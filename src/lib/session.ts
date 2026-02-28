// Generates and persists an anonymous session ID in localStorage
// so a user's rating is tracked across page loads without auth.
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("whiskey_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("whiskey_session_id", id);
  }
  return id;
}
