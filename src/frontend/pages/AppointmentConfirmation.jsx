import { useLocation, useNavigate } from "react-router-dom";

function slotLabel(slot) {
  if (slot === "AM") return "Morning (09:00–12:00)";
  if (slot === "PM") return "Afternoon (13:00–17:00)";
  return slot || "—";
}

function getDateOnly(appt) {
  const raw = String(appt?.date || appt?.scheduledAt || appt?.time || "");
  if (!raw) return "";
  if (raw.includes("T")) return raw.split("T")[0];
  // 如果是 "YYYY-MM-DD HH:mm"
  if (raw.includes(" ")) return raw.split(" ")[0];
  return raw;
}

export default function AppointmentConfirmation() {
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!state) {
    return (
      <div style={{ padding: 40 }}>
        <h2>⚠️ No appointment data</h2>
        <button onClick={() => navigate("/patient")}>Back</button>
      </div>
    );
  }

  const appt = state?.appointment || {};
  const patient = state?.patient || {};
  const location = state?.location || {}; // 可能不存在，保留兼容

  const dateOnly = getDateOnly(appt);

  // location 顯示優先序：state.location > patient.loc > appt.location
  const locText =
    location.addressText ||
    patient.loc ||
    appt.location ||
    "—";

  // patient id 顯示：id(身分證) > patientId (舊) > PID (更舊)
  const pidText = patient.id || patient.patientId || patient.PID || "—";

  return (
    <div style={{ padding: 40, maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ color: "#2E7D32" }}>Appointment Submitted</h2>
      <p style={{ marginBottom: 24 }}>
        Your appointment request has been successfully submitted.
      </p>

      <div style={cardStyle}>
        <Line label="Patient" value={`${patient.name || "—"} (${pidText})`} />
        <Line label="Date" value={dateOnly || "—"} />
        <Line label="Time Slot" value={slotLabel(appt.timeSlot)} />
        <Line label="Subject" value={appt.subject || "—"} />
        <Line label="Symptoms" value={appt.symptoms || "—"} />
        <Line label="Location" value={locText} />
        <Line label="Status" value={appt.status || "PENDING"} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button onClick={() => navigate("/patient")} style={primaryBtn}>
          Back to Patient Home
        </button>
        <button onClick={() => navigate("/patient")} style={secondaryBtn}>
          Make Another Appointment
        </button>
      </div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
      <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{value || "—"}</div>
    </div>
  );
}

const cardStyle = {
  padding: 20,
  borderRadius: 16,
  border: "1px solid #ddd",
  background: "#fff",
};

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#2E7D32",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};