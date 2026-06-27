import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import api from "../lib/api";

export default function AnalyseMasseSalariale({ chantierId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const fetchAnalyse = async () => {
      try {
        const res = await api.get(`/equipe/analyse/${chantierId}`);
        setData(res.data);
      } catch (e) {
        setErr("Erreur de chargement de l'analyse");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalyse();
  }, [chantierId]);

  if (loading) return <p className="p-4">Chargement de l’analyse...</p>;
  if (err) return <p className="p-4 text-red-500">{err}</p>;
  if (!data) return null;

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-4xl relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-600 dark:text-gray-300 hover:text-red-500"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
          📊 Analyse Masse Salariale
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">💰 Total Salaires</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {data.totalSalaires.toLocaleString()} F
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">⏱️ Total Heures</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {data.totalHeures.toFixed(1)} h
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">⚖️ Moyenne Horaire</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {data.moyenneHoraire.toFixed(2)} F
            </p>
          </div>
        </div>

        {/* === Graphique circulaire par rôle === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
              Répartition par rôle
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.repartition}
                  dataKey="total"
                  nameKey="role"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.repartition.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => `${value.toLocaleString()} F`}
                  labelFormatter={(name) => `Rôle: ${name}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* === Graphique en barres par salaire === */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
              Salaires par rôle
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.repartition}>
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip formatter={(v) => `${v.toLocaleString()} F`} />
                <Bar dataKey="total" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
