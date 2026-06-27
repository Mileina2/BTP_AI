import { useEffect, useState } from "react";
import api from "../lib/api";
import { HardHat, Mail, UserPlus, CheckCircle2 } from "lucide-react";
import { linkAccent, textMuted, textPrimary } from "../lib/uiClasses";

const inputCls =
  "w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";

export default function ChefAccessBlock({ chantierId, chefChantier, onUpdated }) {
  const [chefs, setChefs] = useState([]);
  const [selectedChefId, setSelectedChefId] = useState(chefChantier?.id || "");
  const [assignLoading, setAssignLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ nom: "", prenom: "", email: "", motDePasse: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/user/team").then((res) => {
      const list = (res.data || []).filter((u) => u.role === "CHEF_CHANTIER");
      setChefs(list);
    }).catch(() => {});
  }, [chefChantier?.id]);

  useEffect(() => {
    setSelectedChefId(chefChantier?.id || "");
  }, [chefChantier?.id]);

  const assignChef = async () => {
    setAssignLoading(true);
    setErr("");
    setMsg("");
    try {
      await api.post("/user/assign-chef", {
        chantierId,
        chefUserId: selectedChefId || null,
      });
      setMsg(selectedChefId ? "Chef assigné au chantier." : "Chef retiré du chantier.");
      onUpdated?.();
    } catch (e) {
      setErr(e.response?.data?.error || "Assignation impossible");
    } finally {
      setAssignLoading(false);
    }
  };

  const inviteChef = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setErr("");
    setMsg("");
    try {
      const payload = {
        nom: inviteForm.nom.trim(),
        prenom: inviteForm.prenom.trim(),
        email: inviteForm.email.trim(),
        chantierId,
      };
      if (inviteForm.motDePasse.trim()) payload.motDePasse = inviteForm.motDePasse.trim();
      const res = await api.post("/user/invite-chef", payload);
      const temp = res.data.motDePasseTemporaire;
      setMsg(
        res.data.emailSent
          ? res.data.message || "Invitation envoyée par email."
          : temp
            ? `${res.data.message} Mot de passe temporaire : ${temp}`
            : res.data.message || "Chef invité."
      );
      setInviteForm({ nom: "", prenom: "", email: "", motDePasse: "" });
      onUpdated?.();
    } catch (e) {
      setErr(e.response?.data?.error || "Invitation impossible");
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 space-y-4">
      <div className="flex items-center gap-2">
        <HardHat className="w-5 h-5 text-amber-600" />
        <h4 className={`font-medium text-sm ${textPrimary}`}>Accès chef de chantier</h4>
      </div>

      {chefChantier ? (
        <div className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className={textPrimary}>
              <strong>{chefChantier.nom || "Chef assigné"}</strong>
            </p>
            <p className={`${textMuted} flex items-center gap-1 mt-0.5`}>
              <Mail className="w-3.5 h-3.5" /> {chefChantier.email}
            </p>
          </div>
        </div>
      ) : (
        <p className={`text-sm ${textMuted}`}>Aucun chef de chantier assigné à ce projet.</p>
      )}

      <div className="space-y-2">
        <label className={`text-xs font-medium ${textMuted}`}>Assigner un chef existant</label>
        <select
          value={selectedChefId}
          onChange={(e) => setSelectedChefId(e.target.value)}
          className={inputCls}
        >
          <option value="">— Aucun chef —</option>
          {chefs.map((c) => {
            const id = c.id || c._id;
            return (
              <option key={id} value={id}>
                {[c.prenom, c.nom].filter(Boolean).join(" ")} ({c.email})
              </option>
            );
          })}
        </select>
        <button
          type="button"
          onClick={assignChef}
          disabled={assignLoading}
          className="w-full py-2 text-sm font-medium rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 disabled:opacity-50"
        >
          {assignLoading ? "Mise à jour…" : "Appliquer l'assignation"}
        </button>
      </div>

      <form onSubmit={inviteChef} className="space-y-2 border-t border-amber-200 dark:border-amber-800 pt-4">
        <p className={`text-xs font-medium flex items-center gap-1 ${textMuted}`}>
          <UserPlus className="w-3.5 h-3.5" /> Inviter un nouveau chef (email + lien mot de passe)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Prénom *"
            required
            value={inviteForm.prenom}
            onChange={(e) => setInviteForm({ ...inviteForm, prenom: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Nom *"
            required
            value={inviteForm.nom}
            onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })}
            className={inputCls}
          />
        </div>
        <input
          type="email"
          placeholder="Email *"
          required
          value={inviteForm.email}
          onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
          className={inputCls}
        />
        <input
          type="password"
          placeholder="Mot de passe (optionnel)"
          value={inviteForm.motDePasse}
          onChange={(e) => setInviteForm({ ...inviteForm, motDePasse: e.target.value })}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={inviteLoading}
          className="w-full py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
        >
          {inviteLoading ? "Envoi…" : "Inviter et assigner à ce chantier"}
        </button>
      </form>

      <a href="#/acces" className={`text-xs ${linkAccent}`}>Tous les accès & équipe →</a>

      {msg && (
        <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {err}
        </p>
      )}
    </div>
  );
}
