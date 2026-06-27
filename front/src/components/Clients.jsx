import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/client")
      .then((res) => setClients(res.data))
      .catch((err) => {
        setError("Non autorisé ou erreur API");
        console.error(err);
      });
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <ul>
      {clients.map((c) => (
        <li key={c._id}>{c.nom}</li>
      ))}
    </ul>
  );
}
