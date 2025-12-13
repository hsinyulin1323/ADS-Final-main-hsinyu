import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppointments } from "../state/AppointmentContext";

export default function DoctorConfirmAppointments() {
  const nav = useNavigate();
  const { pending, confirmAppointment, deleteAppointment } = useAppointments();

  const sortedPending = useMemo(() => {
    return [...pending].sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
  }, [pending]);

  // demo：假設醫生名稱
  const [doctorName, setDoctorName] = useState("Dr. Chen");

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Confirm Appointments</h2>
        <button onClick={() => nav("/")} style={btnLight}>Back to Main</button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Doctor:</div>
        <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} style={input} />
        <div style={{ color: "#666" }}>Pending: <b>{sortedPending.length}</b></div>
      </div>

      <div style={{ marginTop: 16 }}>
        {sortedPending.length === 0 ? (
          <p style={{ color: "#666" }}>No pending appointments.</p>
        ) : (
          sortedPending.map((a) => (
            <PendingCard
              key={a.id}
              appt={a}
              doctorName={doctorName}
              onConfirm={(priority) => confirmAppointment({ id: a.id, priority, doctorName })}
              onDelete={() => {
                if (window.confirm("Delete this appointment?")) deleteAppointment(a.id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PendingCard({ appt, doctorName, onConfirm, onDelete }) {
  const [priority, setPriority] = useState("3");

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900 }}>
          {appt.patientName} ({appt.patientId}) · {appt.subject}
        </div>
        <div style={{ fontWeight: 800, color: "#b71c1c" }}>PENDING</div>
      </div>

      <div style={{ marginTop: 8, color: "#333" }}>
        <div><b>Time:</b> {appt.scheduledAt?.replace("T", " ")}</div>
        <div><b>Location:</b> {appt.location}</div>
        <div><b>Doctor:</b> {doctorName}</div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontWeight: 700 }}>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={input}>
          <option value="1">1 (Most urgent)</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5 (Least urgent)</option>
        </select>

        <button onClick={() => onConfirm(priority)} style={btnPrimary}>Confirm & Add to Schedule</button>
        <button onClick={onDelete} style={btnDanger}>Delete</button>
      </div>
    </div>
  );
}

const card = { border: "1px solid #ddd", borderRadius: 12, padding: 14, background: "white", marginBottom: 12 };
const input = { padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc" };
const btnPrimary = { padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "#2E7D32", color: "white", fontWeight: 800 };
const btnDanger = { padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: "#C62828", color: "white", fontWeight: 800 };
const btnLight = { padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer", background: "white", fontWeight: 800 };