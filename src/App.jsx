import { useState } from "react"
import PatientProfile from "./PatientProfile"
import HealthTimeline from "./HealthTimeline"
import AddHealthRecord from "./AddHealthRecord"
import "./style.css"

function App() {
  const [healthEvents, setHealthEvents] = useState([
    {
      year: 2022,
      type: "Vaccination",
      description: "COVID-19 vaccination"
    },
    {
      year: 2024,
      type: "Doctor Visit",
      description: "General health consultation"
    },
    {
      year: 2025,
      type: "Blood Test",
      description: "Routine blood test"
    },
    {
      year: 2026,
      type: "Medication",
      description: "Prescription added"
    }
  ])

  function addHealthRecord(newRecord) {
    const newEvent = {
      year: new Date(newRecord.date).getFullYear(),
      type: newRecord.type,
      description: `${newRecord.title} - ${newRecord.description}`
    }

    setHealthEvents([...healthEvents, newEvent])
  }

  return (
    <div className="app">
      <h1>HealthThread</h1>

      <p className="subtitle">
        Your lifelong health history, connected in one place.
      </p>

      <PatientProfile />

      <AddHealthRecord onAddRecord={addHealthRecord} />

      <HealthTimeline events={healthEvents} />
    </div>
  )
}

export default App