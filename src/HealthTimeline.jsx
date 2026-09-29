function HealthTimeline({ events }) {
  return (
    <div className="timeline">
      <h2>Health Timeline</h2>

      {events.map((event, index) => (
        <div
          className="timeline-item"
          key={`${event.year}-${event.type}-${index}`}
        >
          <h3>
            {event.year} - {event.type}
          </h3>

          <p>{event.description}</p>
        </div>
      ))}
    </div>
  )
}

export default HealthTimeline