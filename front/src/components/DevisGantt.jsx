import { Plus, Trash2 } from "lucide-react";

function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function DevisGantt({ tasks = [], onChange, sections = [] }) {
  const updateTask = (index, key, value) => {
    onChange(tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  };

  const addTask = () => {
    const start = tasks.length ? tasks[tasks.length - 1].dateFin || new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    onChange([
      ...tasks,
      {
        libelle: "Nouvelle phase",
        section: sections[0] || "Général",
        dateDebut: start,
        dateFin: addDays(start, 7),
      },
    ]);
  };

  const removeTask = (index) => {
    onChange(tasks.filter((_, i) => i !== index));
  };

  const validTasks = tasks.filter((t) => t.libelle?.trim() && t.dateDebut && t.dateFin);
  const startMs = validTasks.length
    ? Math.min(...validTasks.map((t) => new Date(t.dateDebut).getTime()))
    : Date.now();
  const endMs = validTasks.length
    ? Math.max(...validTasks.map((t) => new Date(t.dateFin).getTime()))
    : startMs + 7 * 86400000;
  const span = Math.max(endMs - startMs, 86400000);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end rounded-lg border border-gray-200 dark:border-gray-600 p-2.5 bg-gray-50/50 dark:bg-gray-900/30">
            <div className="md:col-span-3">
              <label className="text-[10px] text-gray-500">Libellé</label>
              <input
                value={task.libelle}
                onChange={(e) => updateTask(index, "libelle", e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700"
                placeholder="Ex. Gros œuvre"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-gray-500">Lot</label>
              <input
                list={`gantt-sections-${index}`}
                value={task.section || ""}
                onChange={(e) => updateTask(index, "section", e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700"
              />
              <datalist id={`gantt-sections-${index}`}>
                {sections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-gray-500">Début</label>
              <input
                type="date"
                value={toInputDate(task.dateDebut)}
                onChange={(e) => updateTask(index, "dateDebut", e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] text-gray-500">Fin</label>
              <input
                type="date"
                value={toInputDate(task.dateFin)}
                onChange={(e) => updateTask(index, "dateFin", e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={() => removeTask(index)}
                className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTask}
        className="w-full py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center gap-1 rounded-lg border border-dashed border-blue-200 dark:border-blue-800"
      >
        <Plus className="w-3.5 h-3.5" /> Ajouter une phase
      </button>

      {validTasks.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-white dark:bg-gray-800">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Diagramme de Gantt</p>
          <div className="space-y-1.5">
            {validTasks.map((task, index) => {
              const tStart = new Date(task.dateDebut).getTime();
              const tEnd = new Date(task.dateFin).getTime();
              const left = ((tStart - startMs) / span) * 100;
              const width = Math.max(((tEnd - tStart) / span) * 100, 2);
              return (
                <div key={index} className="grid grid-cols-[140px_1fr] gap-2 items-center text-[11px]">
                  <span className="truncate text-gray-600 dark:text-gray-300" title={task.libelle}>
                    {task.libelle}
                  </span>
                  <div className="relative h-5 bg-gray-100 dark:bg-gray-700 rounded">
                    <div
                      className="absolute top-0.5 h-4 rounded bg-blue-500/90"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${toInputDate(task.dateDebut)} → ${toInputDate(task.dateFin)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
