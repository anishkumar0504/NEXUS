import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function getInfo() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUser(data.user);
      }
    }

    getInfo();
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{user?.email}</p>
    </div>
  );
}