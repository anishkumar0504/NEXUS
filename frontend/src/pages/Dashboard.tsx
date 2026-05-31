import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import axios from "axios";  
import { BACKEND_URL } from "../lib/config";
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
const navigate = useNavigate();
  useEffect(() => {
    async function getInfo() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        setUser(data.user);
      }else{
        navigate("/")
      }
    }

    getInfo();
  }, []);

 useEffect(() => {
  async function getExistingConversation() {
    if (!user) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const jwt = session?.access_token;
console.log("JWT:", `${BACKEND_URL}conversation`);
    const response = await axios.get(
      `${BACKEND_URL}/conversation`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    );

    console.log(response.data);
  }

  getExistingConversation();
}, [user]);

  return (
    <div>
      <h1>Dashboard</h1>
      {!user && <button onClick={()=>navigate("/")}>Signin</button>}
      <p>{user?.email}</p>
      <button onClick={() => {supabase.auth.signOut()
    setUser(null)    
    }
      }>Sign Out</button>
    </div>
  );
}