
import { useState } from "react";

function HealthTimeline({ events, onUpdateRecord, onDeleteRecord }) {
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

  function startEditing(record) {
    setEditingId(record.id);
    setForm({
      type: record.type,
      date: record.date || "",
      title: record.title || "",
      description: record.description || "",
    });
    setError("");
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

    try {
      await onDeleteRecord(recordId);
    } catch (err) {
      setError(err.message || "Could not delete this record.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="timeline">
      <h2>Health Timeline</h2>

      {error && <p role="alert" className="record-error">{error}</p>}

      {events.length === 0 ? (
        <p>
          No health records yet. Add your first record to start
          building your health timeline.
        </p>
      ) : (
        events.map((record) => (
          <div className="timeline-item" key={record.id}>
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
                <h3>
                  {record.year} - {record.type}
                </h3>

                {record.title && (
                  <p><strong>{record.title}</strong></p>
                )}

                <p>{record.description}</p>

                {record.date && <small>{record.date}</small>}

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
          </div>
        ))
      )}
    </div>
  );
}

export default HealthTimeline;
