import { useState } from "react";
import PatientProfile from "./PatientProfile";
import HealthTimeline from "./HealthTimeline";
import AddHealthRecord from "./AddHealthRecord";
import "./style.css";

const initialHealthEvents = [
  {
    id: "demo-2022",
    year: 2022,
    type: "Vaccination",
    description: "COVID-19 vaccination",
  },
  {
    id: "demo-2024",
    year: 2024,
    type: "Doctor Visit",
    description: "General health consultation",
  },
  {
    id: "demo-2025",
    year: 2025,
    type: "Blood Test",
    description: "Routine blood test",
  },
  {
    id: "demo-2026",
    year: 2026,
    type: "Medication",
    description: "Prescription added",
  },
];

function loadHealthEvents() {
  try {
    const saved = localStorage.getItem("healththread-records");
    return saved ? JSON.parse(saved) : initialHealthEvents;
  } catch {
    return initialHealthEvents;
  }
}

function App() {
  const [healthEvents, setHealthEvents] = useState(loadHealthEvents);

  function addHealthRecord(newRecord) {
    const newEvent = {
      id: crypto.randomUUID(),
      year: new Date(newRecord.date + "T12:00:00").getFullYear(),
      date: newRecord.date,
      type: newRecord.type,
      title: newRecord.title,
      description: newRecord.description,
    };

    setHealthEvents((currentEvents) => {
      const updatedEvents = [...currentEvents, newEvent];

      try {
        localStorage.setItem(
          "healththread-records",
          JSON.stringify(updatedEvents)
        );
      } catch (error) {
        console.error("Could not save health records:", error);
      }

      return updatedEvents;
    });
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
  );
}

export default App;
