
import { useState, useEffect } from "react";
import PatientProfile from "./PatientProfile";
import HealthTimeline from "./HealthTimeline";
import AddHealthRecord from "./AddHealthRecord";
import Auth from "./Auth";
import { supabase } from "./lib/supabaseClient";
import "./style.css";

function mapDatabaseRecord(record) {
  const date = record.record_date || "";
  return {
    id: record.id,
    year: date ? Number(date.slice(0, 4)) : null,
    date,
    type: record.record_type,
    title: record.title,
    description: record.description || "",
  };
}

function formatRecordDate(date) {
  if (!date) return "No date";
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

function parseHealthRecordDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

function HealthPassport({
  events,
  isLoading,
  loadError,
  onClose,
  onPrint,
}) {
  const categoryCounts = new Map();
  events.forEach((record) => {
    const type = String(record.type ?? "").trim();
    if (type) categoryCounts.set(type, (categoryCounts.get(type) || 0) + 1);
  });
  const categories = [...categoryCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  const sortedRecords = [...events].sort((a, b) => {
    const aDate = parseHealthRecordDate(a.date)?.getTime() ?? Number.NaN;
    const bDate = parseHealthRecordDate(b.date)?.getTime() ?? Number.NaN;
    const aValid = Number.isFinite(aDate);
    const bValid = Number.isFinite(bDate);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    return aDate - bDate;
  });
  const recordGroups = [];
  sortedRecords.forEach((record) => {
    const validDate = parseHealthRecordDate(record.date);
    const label = validDate
      ? String(validDate.getFullYear())
      : "Date not recorded";
    let group = recordGroups.find((item) => item.label === label);
    if (!group) {
      group = { label, records: [] };
      recordGroups.push(group);
    }
    group.records.push(record);
  });
  const newestRecord = [...events]
    .filter((record) => parseHealthRecordDate(record.date))
    .sort((a, b) =>
      parseHealthRecordDate(b.date) - parseHealthRecordDate(a.date)
    )[0];
  const generatedDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="passport-view">
      <div className="passport-screen-actions">
        <button type="button" className="passport-back" onClick={onClose}>
          Back to Overview
        </button>
        <button
          type="button"
          className="passport-print-button"
          onClick={onPrint}
          disabled={isLoading}
        >
          Print / Save as PDF
        </button>
      </div>

      <article className="passport-document">
        <div className="passport-brandline">
          <span className="passport-wordmark">HealthThread</span>
          <span className="passport-confidentiality">PRIVATE HEALTH SUMMARY</span>
        </div>

        <header className="passport-heading">
          <p className="passport-eyebrow">PERSONAL RECORDS</p>
          <h2>Personal Health Passport</h2>
          <p>
            A summary of the health records saved in your HealthThread account.
          </p>
          <p className="passport-generated">Generated {generatedDate}</p>
        </header>

        <p className="passport-disclaimer">
          User-maintained information. This summary may be incomplete and has
          not been independently verified. Please confirm important details
          with your healthcare professional.
        </p>

        {loadError && (
          <p className="passport-load-error" role="alert">
            Saved records could not be loaded. This passport does not show a
            complete record history.
          </p>
        )}

        <section className="passport-section" aria-labelledby="passport-overview-title">
          <h3 id="passport-overview-title">Record overview</h3>
          <div className="passport-summary">
            <div>
              <span>Total health records</span>
              <strong>{isLoading || loadError ? "—" : events.length}</strong>
            </div>
            <div>
              <span>Record categories</span>
              <strong>{isLoading || loadError ? "—" : categories.length}</strong>
            </div>
            <div>
              <span>Most recent record</span>
              <strong>
                {isLoading || loadError
                  ? "—"
                  : newestRecord
                    ? formatRecordDate(newestRecord.date)
                    : events.length
                      ? "Date unavailable"
                      : "No records yet"}
              </strong>
            </div>
          </div>
        </section>

        <section className="passport-section" aria-labelledby="passport-profile-title">
          <h3 id="passport-profile-title">Personal profile</h3>
          <p className="passport-profile-note">
            Personal profile details have not been supplied. This passport
            contains saved health records only.
          </p>
        </section>

        <section className="passport-section" aria-labelledby="passport-categories-title">
          <h3 id="passport-categories-title">Record categories</h3>
          {isLoading ? (
            <p className="passport-muted">Loading saved records...</p>
          ) : loadError ? (
            <p className="passport-muted">
              Categories are unavailable until saved records can be loaded.
            </p>
          ) : categories.length ? (
            <ul className="passport-category-list">
              {categories.map(([type, count]) => (
                <li key={type}>
                  <span>{type}</span>
                  <span>{count} {count === 1 ? "record" : "records"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="passport-muted">No record categories have been saved.</p>
          )}
        </section>

        <section className="passport-section passport-history" aria-labelledby="passport-history-title">
          <h3 id="passport-history-title">Health record history</h3>
          {isLoading ? (
            <p className="passport-muted">Loading saved records...</p>
          ) : loadError ? (
            <p className="passport-muted">
              Record history is unavailable until the saved records can be loaded.
            </p>
          ) : recordGroups.length ? (
            recordGroups.map((group) => (
              <section className="passport-year-group" key={group.label}>
                <h4>{group.label}</h4>
                <div className="passport-record-list">
                  {group.records.map((record) => {
                    const validDate = parseHealthRecordDate(record.date);
                    const title = String(record.title ?? "").trim();
                    const description = String(record.description ?? "").trim();
                    const type = String(record.type ?? "").trim();
                    return (
                      <article className="passport-record" key={record.id}>
                        <div className="passport-record-meta">
                          <span>{type || "Type not recorded"}</span>
                          <time>
                            {validDate
                              ? formatRecordDate(record.date)
                              : "Date not recorded"}
                          </time>
                        </div>
                        {title && <h5>{title}</h5>}
                        <p>
                          {description || (
                            <span className="passport-muted">
                              Description not provided.
                            </span>
                          )}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="passport-empty-state">
              <h4>No health records yet</h4>
              <p>Records you save in HealthThread will appear in this section.</p>
            </div>
          )}
        </section>

        <footer className="passport-footer">
          HealthThread · Personal health records, organized in one place.
        </footer>
      </article>
    </main>
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  let firstNonWhitespace = 0;
  while (firstNonWhitespace < text.length) {
    const characterCode = text.charCodeAt(firstNonWhitespace);
    if (
      characterCode > 0x20 &&
      characterCode !== 0xa0 &&
      characterCode !== 0xfeff
    ) {
      break;
    }
    firstNonWhitespace += 1;
  }
  const safeText = ["=", "+", "-", "@"].includes(text[firstNonWhitespace])
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [healthEvents, setHealthEvents] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [activeSection, setActiveSection] = useState("overview");
  const [showPassport, setShowPassport] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const recordTypes = [...new Set(
    healthEvents.map((record) => record.type).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleRecords = [...healthEvents]
    .filter((record) => {
      const matchesSearch =
        !normalizedSearch ||
        [record.title, record.description, record.type].some((value) =>
          String(value ?? "").toLocaleLowerCase().includes(normalizedSearch)
        );
      return matchesSearch &&
        (selectedType === "all" || record.type === selectedType);
    })
    .sort((a, b) => {
      const aDate = a.date ? Date.parse(`${a.date}T00:00:00`) : Number.NaN;
      const bDate = b.date ? Date.parse(`${b.date}T00:00:00`) : Number.NaN;
      const aValid = Number.isFinite(aDate);
      const bValid = Number.isFinite(bDate);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return sortOrder === "newest" ? bDate - aDate : aDate - bDate;
    });
  const newestRecord = [...healthEvents]
    .filter((record) =>
      record.date && Number.isFinite(Date.parse(`${record.date}T00:00:00`))
    )
    .sort((a, b) =>
      Date.parse(`${b.date}T00:00:00`) - Date.parse(`${a.date}T00:00:00`)
    )[0];

  function exportRecords() {
    if (healthEvents.length === 0) return;

    const rows = [
      ["Record type", "Title", "Date", "Description"],
      ...healthEvents.map((record) => [
        record.type,
        record.title,
        record.date,
        record.description,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `healththread-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage(`CSV exported with ${healthEvents.length} record${healthEvents.length === 1 ? "" : "s"}.`);
  }

  // Check whether the user is already logged in.
  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(data.session ?? null);
        }
      } catch (error) {
        console.error("Could not load session:", error.message);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load health records belonging to the signed-in user.
  useEffect(() => {
    if (!session?.user?.id) {
      setHealthEvents([]);
      setRecordsLoading(false);
      setRecordsError("");
      return;
    }

    let cancelled = false;

    async function loadHealthRecords() {
      setRecordsLoading(true);
      setRecordsError("");

      try {
        const { data, error } = await supabase
          .from("health_records")
          .select(
            "id, record_type, title, record_date, description"
          )
          .order("record_date", { ascending: true });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setHealthEvents((data ?? []).map(mapDatabaseRecord));
        }
      } catch (error) {
        console.error("Could not load health records:", error);

        if (!cancelled) {
          setRecordsError(
            error.message || "Could not load your health records."
          );
          setHealthEvents([]);
        }
      } finally {
        if (!cancelled) {
          setRecordsLoading(false);
        }
      }
    }

    loadHealthRecords();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Save a new record to Supabase.
  async function addHealthRecord(newRecord) {
    if (!session?.user?.id) {
      throw new Error("Please log in before adding a health record.");
    }

    const { data, error } = await supabase
      .from("health_records")
      .insert({
        user_id: session.user.id,
        record_type: newRecord.type,
        title: newRecord.title.trim(),
        record_date: newRecord.date,
        description: newRecord.description.trim(),
      })
      .select(
        "id, record_type, title, record_date, description"
      )
      .single();

    if (error) {
      console.error("Could not save health record:", error);
      throw new Error(error.message || "Could not save your record.");
    }

    const savedEvent = mapDatabaseRecord(data);

    setHealthEvents((currentEvents) =>
      [...currentEvents, savedEvent].sort((a, b) =>
        a.date.localeCompare(b.date)
      ));
    setExportMessage("");
  }
async function updateHealthRecord(recordId, updatedRecord) {
  const { data, error } = await supabase
    .from("health_records")
    .update({
      record_type: updatedRecord.type,
      title: updatedRecord.title.trim(),
      record_date: updatedRecord.date,
      description: updatedRecord.description.trim(),
    })
    .eq("id", recordId)
    .select("id, record_type, title, record_date, description")
    .single();

  if (error) {
    console.error("Could not update health record:", error);
    throw new Error(error.message || "Could not update the record.");
  }

  const savedEvent = mapDatabaseRecord(data);

  setHealthEvents((currentEvents) =>
    currentEvents
      .map((event) => event.id === recordId ? savedEvent : event)
      .sort((a, b) => a.date.localeCompare(b.date))
  );
  setExportMessage("");
}

async function deleteHealthRecord(recordId) {
  const { error } = await supabase
    .from("health_records")
    .delete()
    .eq("id", recordId);

  if (error) {
    console.error("Could not delete health record:", error);
    throw new Error(error.message || "Could not delete the record.");
  }

  setHealthEvents((currentEvents) =>
    currentEvents.filter((event) => event.id !== recordId)
  );
  setExportMessage("");
}
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Could not sign out:", error.message);
      setRecordsError("Could not sign out. Please try again.");
    }
  }

  if (authLoading) {
    async function updateHealthRecord(recordId, updatedRecord) {
  const { data, error } = await supabase
    .from("health_records")
    .update({
      record_type: updatedRecord.type,
      title: updatedRecord.title.trim(),
      record_date: updatedRecord.date,
      description: updatedRecord.description.trim(),
    })
    .eq("id", recordId)
    .select("id, record_type, title, record_date, description")
    .single();

  if (error) throw new Error(error.message);

  const savedEvent = {
    id: data.id,
    year: Number(data.record_date.slice(0, 4)),
    date: data.record_date,
    type: data.record_type,
    title: data.title,
    description: data.description || "",
  };

  setHealthEvents((current) =>
    current
      .map((event) => (event.id === recordId ? savedEvent : event))
      .sort((a, b) => a.date.localeCompare(b.date))
  );
}

async function deleteHealthRecord(recordId) {
  const { error } = await supabase
    .from("health_records")
    .delete()
    .eq("id", recordId);

  if (error) throw new Error(error.message);

  setHealthEvents((current) =>
    current.filter((event) => event.id !== recordId)
  );
}
    return (
      <main className="app-loading" role="status">
        <span className="loading-mark" aria-hidden="true">H</span>
        <p>Loading HealthThread...</p>
      </main>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const navigation = [
    { id: "overview", label: "Overview", href: "#overview" },
    { id: "timeline", label: "Health Timeline", href: "#timeline" },
    { id: "add-record", label: "Add Health Record", href: "#add-record" },
    { id: "profile", label: "Patient Profile", href: "#profile" },
    { id: "passport", label: "Health Passport" },
  ];
  const sectionDetails = {
    overview: {
      title: "Overview",
      description: "Your health history, organized in one place.",
    },
    timeline: {
      title: "Health Timeline",
      description: "Browse and manage your saved health records.",
    },
    "add-record": {
      title: "Add Health Record",
      description: "Record a visit, test, medication, or other health event.",
    },
    profile: {
      title: "Patient Profile",
      description: "Personal profile details will be available in a future step.",
    },
    passport: {
      title: "Health Passport",
      description: "A printable summary of your saved health records.",
    },
  };
  const currentSection = sectionDetails[activeSection];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a
          className="brand"
          href="#overview"
          onClick={() => {
            setActiveSection("overview");
            setShowPassport(false);
          }}
          aria-label="HealthThread overview"
        >
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>HealthThread</span>
        </a>

        <p className="sidebar-label">WORKSPACE</p>
        <nav className="primary-nav">
          {navigation.map((item) => {
            const className =
              `nav-link${activeSection === item.id ? " is-active" : ""}`;
            if (item.id === "passport") {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={className}
                  aria-current={activeSection === item.id ? "page" : undefined}
                  onClick={() => {
                    setActiveSection(item.id);
                    setShowPassport(true);
                  }}
                >
                  {item.label}
                </button>
              );
            }
            return (
              <a
                key={item.id}
                className={className}
                href={item.href}
                aria-current={activeSection === item.id ? "page" : undefined}
                onClick={() => {
                  setActiveSection(item.id);
                  setShowPassport(false);
                }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-eyebrow">PERSONAL HEALTH RECORDS</p>
            <h1>{currentSection.title}</h1>
            <p className="topbar-description">{currentSection.description}</p>
          </div>
          <div className="topbar-account">
            <span title={session.user.email}>{session.user.email}</span>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {showPassport ? (
          <HealthPassport
            events={healthEvents}
            isLoading={recordsLoading}
            loadError={recordsError}
            onClose={() => {
              setShowPassport(false);
              setActiveSection("overview");
            }}
            onPrint={() => window.print()}
          />
        ) : (
        <main className="workspace-content" id="overview">
          {recordsError && (
            <p role="alert" className="record-error">
              {recordsError}
            </p>
          )}

          <section className="summary-strip" aria-label="Record summary">
            <div className="summary-item">
              <span className="summary-label">Health records</span>
              <strong>{recordsLoading || recordsError ? "—" : healthEvents.length}</strong>
            </div>
            <div className="summary-item">
              <span className="summary-label">Record categories</span>
              <strong>{recordsLoading || recordsError ? "—" : recordTypes.length}</strong>
            </div>
            <div className="summary-item summary-recent">
              <span className="summary-label">Most recent record</span>
              <strong>
                {recordsLoading || recordsError
                  ? "—"
                  : newestRecord
                    ? formatRecordDate(newestRecord.date)
                    : healthEvents.length > 0
                      ? "Date unavailable"
                      : "No records yet"}
              </strong>
            </div>
          </section>

          <div className="workspace-grid">
            <section id="profile" className="profile-region">
              <PatientProfile />
            </section>

            <section id="add-record" className="entry-region">
              <AddHealthRecord onAddRecord={addHealthRecord} />
            </section>

            <section id="timeline" className="timeline-region">
              {recordsLoading ? (
                <div className="timeline-loading" role="status">
                  <span className="loading-indicator" aria-hidden="true" />
                  <p>Loading your health records...</p>
                </div>
              ) : (
                <HealthTimeline
                  events={visibleRecords}
                  totalCount={healthEvents.length}
                  recordTypes={recordTypes}
                  search={search}
                  onSearchChange={setSearch}
                  selectedType={selectedType}
                  onTypeChange={setSelectedType}
                  sortOrder={sortOrder}
                  onSortChange={setSortOrder}
                  onExport={exportRecords}
                  exportDisabled={healthEvents.length === 0}
                  exportMessage={exportMessage}
                  onClearFilters={() => {
                    setSearch("");
                    setSelectedType("all");
                  }}
                  onUpdateRecord={updateHealthRecord}
                  onDeleteRecord={deleteHealthRecord}
                />
              )}
            </section>
          </div>
        </main>
        )}
      </div>
    </div>
  );
}

export default App;