import { useState } from "react"

function AddHealthRecord({ onAddRecord }) {
  const [type, setType] = useState("Vaccination")
  const [date, setDate] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  function handleSubmit(event) {
    event.preventDefault()

    const newRecord = {
      date,
      type,
      title,
      description
    }

    onAddRecord(newRecord)

    setDate("")
    setTitle("")
    setDescription("")
  }

  return (
    <div className="form-card">
      <h2>Add Health Record</h2>

      <form onSubmit={handleSubmit}>
        <label>Record Type</label>

        <select
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

        <label>Date</label>

        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <label>Title</label>

        <input
          type="text"
          placeholder="Example: Blood Test"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label>Description</label>

        <textarea
          placeholder="Enter details..."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />

        <button type="submit" className="add-button">
          Save Record
        </button>
      </form>
    </div>
  )
}

export default AddHealthRecord
