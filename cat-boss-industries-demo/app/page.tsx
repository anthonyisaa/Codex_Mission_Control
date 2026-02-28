import { listIncidents } from "@/src/domain/incidents";

const statusTone: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  blocked: "Blocked",
  resolved: "Resolved",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  const params = await searchParams;
  const incidents = await listIncidents({
    status: params.status ?? null,
    severity: params.severity ?? null,
  });

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          Cat Boss Industries
          <small>Mission Operations Console</small>
        </div>
        <div className="nav">
          <a href="/">All incidents</a>
          <a href="/?status=blocked">Blocked incidents</a>
          <a href="/?severity=critical">Critical incidents</a>
        </div>
        <p className="meta">Easter egg codename: Project WHISKER.</p>
      </aside>

      <section className="main">
        <div className="topbar">
          <h1>Incident Triage Board</h1>
          <span className="meta">{incidents.length} active items</span>
        </div>

        <div className="card-grid">
          {incidents.map((incident) => (
            <article key={incident.id} className="card">
              <h3>{incident.title}</h3>
              <p className="meta">{statusTone[incident.status]}</p>
              <p>{incident.description}</p>
              <p>
                <span className={`badge ${incident.severity}`}>{incident.severity}</span>
              </p>
              {incident.severity === "critical" ? (
                <p className="meta">
                  Escalation: {incident.escalationOwner ?? "missing owner"} /{" "}
                  {incident.escalationDueAt ? new Date(incident.escalationDueAt).toLocaleString() : "missing due date"}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
