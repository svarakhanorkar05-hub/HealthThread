import { useState } from "react";

function AddHealthRecord({ onAddRecord }) {
  const [type, setType] = useState("Vaccination");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await onAddRecord({
        date,
        type,
        title,
        description,
      });

      setDate("");
      setTitle("");
      setDescription("");
      setSuccess("Health record saved.");
    } catch (err) {
      setError(err.message || "Could not save the health record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-card">
      <h2>Add Health Record</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor="record-type">Record Type</label>

        <select
          id="record-type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option>Vaccination</option>
          <option>Doctor Visit</option>
          <option>Blood Test</option>
          <option>Medication</option>
          <option>Allergy</option>
          <option>Surgery</option>
        </select>

        <label htmlFor="record-date">Date</label>

        <input
          id="record-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <label htmlFor="record-title">Title</label>

        <input
          id="record-title"
          type="text"
          placeholder="Example: Blood Test"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="record-description">Description</label>

        <textarea
          id="record-description"
          placeholder="Enter details..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />

        {error && (
          <p role="alert" className="record-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="record-success">
            {success}
          </p>
        )}

        <button
          type="submit"
          className="add-button"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Record"}
        </button>
      </form>
    </div>
  );
}

export default AddHealthRecord;