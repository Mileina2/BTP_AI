import { useEffect, useState } from "react";
import api from "../lib/api";
import EquipeForm from "./EquipeForm"; // 👈 on importe le formulaire

export default function Equipe() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false); // 👈 affichage du formulaire

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/equipe");
      setItems(data);
    } catch (e) {
      setErr("Erreur de chargement de l’équipe");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section id="equipe" className="p-5 md:p-10 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-semibold">Équipe de chantier</h3>
        <button
          onClick={() => setShowForm(!showForm)} // 👈 toggle du formulaire
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          {showForm ? "Fermer" : "+ Ajouter un membre"}
        </button>
      </div>

      {/* ✅ Formulaire d’ajout */}
      {showForm && (
        <div className="mb-6">
          <EquipeForm
            onAdded={() => {
              setShowForm(false);
              load(); // recharge la liste après ajout
            }}
          />
        </div>
      )}

      {loading ? (
        <p>Chargement…</p>
      ) : err ? (
        <p className="text-red-500">{err}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">Aucun membre pour l’instant.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700">
              <th className="p-2 text-left">Nom</th>
              <th className="p-2 text-left">Rôle</th>
              <th className="p-2 text-left">Taux horaire</th>
              <th className="p-2 text-left">Heures</th>
              <th className="p-2 text-left">Salaire total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m._id} className="border-b dark:border-gray-700">
                <td className="p-2">{m.nom}</td>
                <td className="p-2">{m.role}</td>
                <td className="p-2">{Number(m.tauxHoraire).toLocaleString()} F</td>
                <td className="p-2">{m.heuresTravaillees} h</td>
                <td className="p-2 text-green-600 dark:text-green-400">
                  {Number(m.salaireTotal).toLocaleString()} F
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
