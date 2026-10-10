
import { useState } from "react";

function HealthTimeline({
  events,
  totalCount,
  recordTypes,
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortOrder,
  onSortChange,
  onExport,
  exportDisabled,
  exportMessage,
  onClearFilters,
  onUpdateRecord,
  onDeleteRecord,
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    type: "Vaccination",
    date: "",
    title: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const hasFilters = Boolean(search.trim() || selectedType !== "all");

  function startEditing(record) {
    setEditingId(record.id);
    setForm({
      type: record.type,
      date: record.date || "",
      title: record.title || "",
      description: record.description || "",
    });
    setError("");
    setFeedback("");
  }

  function handleChange(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onUpdateRecord(editingId, form);
      setEditingId(null);
      setFeedback("Record updated.");
    } catch (err) {
      setError(err.message || "Could not update this record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recordId) {
    const confirmed = window.confirm(
      "Delete this health record permanently? This cannot be undone."
    );

    if (!confirmed) return;

    setDeletingId(recordId);
    setError("");
    setFeedback("");

    try {
      await onDeleteRecord(recordId);
      setFeedback("Record deleted.");
    } catch (err) {
      setError(err.message || "Could not delete this record.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="timeline">
      <div className="timeline-heading">
        <div>
          <p className="section-kicker">RECORDS</p>
          <h2>Health Timeline</h2>
          <p className="timeline-count">
            {totalCount === 1 ? "1 record" : `${totalCount} records`}
            {hasFilters ? ` · Showing ${events.length}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="export-button"
          onClick={onExport}
          disabled={exportDisabled}
        >
          Export CSV
        </button>
      </div>

      <div className="timeline-tools" role="search">
        <label className="search-control">
          <span className="visually-hidden">Search records</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, description, or type"
          />
        </label>
        <label className="filter-control">
          <span className="visually-hidden">Filter by record type</span>
          <select
            value={selectedType}
            onChange={(event) => onTypeChange(event.target.value)}
          >
            <option value="all">All types</option>
            {recordTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="sort-control">
          <span className="visually-hidden">Sort records by date</span>
          <select
            value={sortOrder}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      {exportMessage && (
        <p className="export-feedback" role="status">{exportMessage}</p>
      )}

      {error && <p role="alert" className="record-error">{error}</p>}
      {feedback && <p className="record-feedback" role="status">{feedback}</p>}

      {events.length === 0 ? (
        <div className="timeline-empty">
          <h3>{hasFilters ? "No matching records" : "Your timeline is ready"}</h3>
          <p>
            {hasFilters
              ? "Try another search or clear the selected filters."
              : "Health records you add will appear here, organized by date."}
          </p>
          {hasFilters && (
            <button type="button" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="record-list">
          {events.map((record) => (
          <article className="timeline-item" key={record.id}>
            {editingId === record.id ? (
              <form onSubmit={handleSave}>
                <h3>Edit Health Record</h3>

                <label htmlFor={`type-${record.id}`}>Record type</label>
                <select
                  id={`type-${record.id}`}
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  required
                >
                  {[
                    "Vaccination",
                    "Doctor Visit",
                    "Blood Test",
                    "Medication",
                    "Allergy",
                    "Surgery",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <label htmlFor={`date-${record.id}`}>Date</label>
                <input
                  id={`date-${record.id}`}
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />

                <label htmlFor={`title-${record.id}`}>Title</label>
                <input
                  id={`title-${record.id}`}
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                />

                <label htmlFor={`description-${record.id}`}>
                  Description
                </label>
                <textarea
                  id={`description-${record.id}`}
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  required
                />

                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setEditingId(null);
                    setError("");
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="record-meta">
                  <span className="record-type">{record.type || "Health record"}</span>
                  <span className="record-date">{record.date || "Date unavailable"}</span>
                </div>

                {record.title && (
                  <h3 className="record-title">{record.title}</h3>
                )}

                {record.description && (
                  <p className="record-description">{record.description}</p>
                )}

                <div className="record-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(record)}
                    disabled={deletingId !== null}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(record.id)}
                    disabled={deletingId !== null}
                  >
                    {deletingId === record.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}
          </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default HealthTimeline;
