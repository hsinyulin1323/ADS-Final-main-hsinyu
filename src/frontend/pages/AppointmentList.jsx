import { useState } from "react";

function slotLabel(slot) {
  if (slot === "AM") return "Morning (09:00–12:00)";
  if (slot === "PM") return "Afternoon (13:00–17:00)";
  return slot || "—";
}

const MOCK_APPOINTMENTS = [
  {
    id: "APP001",
    patientId: "B123456789",
    doctorName: "Dr. Chen",
    date: "2025-12-15",
    timeSlot: "AM",
    subject: "眼科",
    symptoms: "視力模糊",
    status: "CONFIRMED",
  },
  {
    id: "APP002",
    patientId: "B123456789",
    doctorName: "Dr. Wang",
    date: "2025-12-20",
    timeSlot: "PM",
    subject: "胸腔科",
    symptoms: "咳嗽三天",
    status: "PENDING",
  },
];

export default function AppointmentList({ items }) {
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) {
    return <p style={{ color: "#777" }}>目前沒有任何預約。</p>;
  }

  return (
    <div>
      {list.map((a) => (
        <div
          key={a._key ?? a.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            marginBottom: 10,
            background: "white",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{a.whenText}</div>
            <div style={{ fontWeight: 800, color: String(a.status).toUpperCase().includes("PENDING") ? "orange" : "#2E7D32" }}>
              {a.status}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
            <div><b>Appointment ID:</b> {a.id}</div>
            <div><b>Patient:</b> {a.patientName} ({a.patientId})</div>
            <div><b>Subject:</b> {a.subject}</div>
            <div><b>Doctor:</b> {a.doctorName} ({a.doctorId})</div>
            <div><b>Location:</b> {a.location}</div>
          </div>
        </div>
      ))}
    </div>
  );
}