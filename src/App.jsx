
import { useState, useEffect } from "react";
import PatientProfile from "./PatientProfile";
import HealthTimeline from "./HealthTimeline";
import AddHealthRecord from "./AddHealthRecord";
import Auth from "./Auth";
import { supabase } from "./lib/supabaseClient";
import "./style.css";

function mapDatabaseRecord(record) {
  return {
    id: record.id,
    year: Number(record.record_date.slice(0, 4)),
    date: record.record_date,
    type: record.record_type,
    title: record.title,
    description: record.description || "",
  };
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [healthEvents, setHealthEvents] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");

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

  const savedEvent = {
    id: data.id,
    year: Number(data.record_date.slice(0, 4)),
    date: data.record_date,
    type: data.record_type,
    title: data.title,
    description: data.description || "",
  };

  setHealthEvents((currentEvents) =>
    currentEvents
      .map((event) => event.id === recordId ? savedEvent : event)
      .sort((a, b) => a.date.localeCompare(b.date))
  );
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
    return <p>Loading HealthThread...</p>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header>
        <h1>HealthThread</h1>

        <p className="subtitle">
          Your lifelong health history, connected in one place.
        </p>

        <p>
          Signed in as {session.user.email}
        </p>

        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <PatientProfile />

      {recordsError && (
        <p role="alert" className="record-error">
          {recordsError}
        </p>
      )}

      <AddHealthRecord onAddRecord={addHealthRecord} />

      {recordsLoading ? (
        <p>Loading your health records...</p>
      ) : (
        <HealthTimeline
  events={healthEvents}
  onUpdateRecord={updateHealthRecord}
  onDeleteRecord={deleteHealthRecord}
/>
      )}
    </div>
  );
}

export default App;