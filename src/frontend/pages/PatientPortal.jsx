// src/frontend/pages/PatientPortal.jsx
import MakeAppointment from "./MakeAppointment";
import QueryAppointment from "./QueryAppointment";
import "../main.css";

export default function PatientPortal() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 16, overflow: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Make Appointment</h2>
        <MakeAppointment />
      </section>

      <section style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: 16, overflow: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Query Appointment</h2>
        {/* 先放 placeholder，之後你再接 QueryAppointment.jsx */}
        <p>TODO: query appointment list / search</p>
      </section>
    </div>
  );
}