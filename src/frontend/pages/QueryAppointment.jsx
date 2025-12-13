import { useState, useMemo } from "react";

const API_BASE = "http://localhost:5001";

function normalizePid(v) {
  return String(v || "").trim().toUpperCase();
}

// 盡量從不同格式取出 date / slot
function getDateSlot(appt) {
  const rawScheduled =
    appt?.scheduledAt ||
    appt?.appointment?.scheduledAt ||
    "";

  // ✅ 新格式：scheduledAt 可能就是 "YYYY-MM-DD"
  const date =
    appt?.date ||
    appt?.appointment?.date ||
    (String(rawScheduled).includes("T")
      ? String(rawScheduled).split("T")[0]
      : String(rawScheduled).match(/^\d{4}-\d{2}-\d{2}$/)
      ? String(rawScheduled)
      : "");

  const timeSlot =
    appt?.timeSlot ||
    appt?.appointment?.timeSlot ||
    appt?.slot ||
    appt?.appointment?.slot ||
    ""; // "AM" | "PM"

  // ✅ 舊格式 fallback：time or scheduledAt
  const timeText =
    appt?.time ||
    appt?.appointment?.time ||
    rawScheduled ||
    "";

  return { date, timeSlot, timeText };
}

function slotLabel(slot) {
  if (slot === "AM") return "上午 (09:00–12:00)";
  if (slot === "PM") return "下午 (13:00–17:00)";
  return slot || "—";
}

export default function QueryAppointment() {
  const [pid, setPid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    const trimmed = normalizePid(pid);
    if (!trimmed) {
      setError("Please enter PID / ID (e.g., B123456789).");
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const res = await fetch(`${API_BASE}/api/appointments`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const all = await res.json();
      const arr = Array.isArray(all) ? all : [];

      // ✅ 病人ID：身分證字號
      const filtered = arr.filter((a) => {
        const apptPid =
          a.patientId ??
          a.patient_id ??
          a.PID ??
          a.pid ??
          a.patient?.id ??
          a.patient?.patientId;
        return normalizePid(apptPid) === trimmed;
      });

      // ✅ 排序：date -> AM/PM -> timeText
      filtered.sort((a, b) => {
        const A = getDateSlot(a);
        const B = getDateSlot(b);

        const dateCmp = String(A.date).localeCompare(String(B.date));
        if (dateCmp !== 0) return dateCmp;

        const slotRank = (s) => (s === "AM" ? 0 : s === "PM" ? 1 : 9);
        const slotCmp = slotRank(A.timeSlot) - slotRank(B.timeSlot);
        if (slotCmp !== 0) return slotCmp;

        return String(A.timeText).localeCompare(String(B.timeText));
      });

      setResults(filtered);
      if (filtered.length === 0) setError("No appointments found for this ID.");
    } catch (e) {
      console.error(e);
      setError("Failed to query appointments. Please check backend (port 5001) and API path.");
    } finally {
      setLoading(false);
    }
  };

  const viewResults = useMemo(() => {
    return results.map((appt, idx) => {
      const { date, timeSlot, timeText } = getDateSlot(appt);

      const id =
        appt.id ??
        appt.appointmentId ??
        appt.appointment?.appointmentId ??
        appt._localId ??
        "";

      const status = appt.status ?? appt.appointment?.status ?? "Unknown";
      const subject = appt.subject ?? appt.appointment?.subject ?? "-";

      const patientName = appt.patientName ?? appt.patient?.name ?? "-";
      const patientId =
        appt.patientId ??
        appt.patient_id ??
        appt.patient?.id ??
        appt.patient?.patientId ??
        "-";

      const doctorName = appt.doctorName ?? appt.doctor?.name ?? "-";
      const doctorId = appt.doctorId ?? appt.doctor?.id ?? "-";

      const location = appt.location ?? appt.loc ?? appt.patient?.loc ?? "-";

      const whenText =
        date && timeSlot
          ? `${date} · ${slotLabel(timeSlot)}`
          : timeText
          ? String(timeText).replace("T", " ")
          : "(no date/slot)";

      // ✅ key：避免 id 空/重複造成 list render 怪異
      const key = id ? `${id}` : `${patientId}-${whenText}-${subject}-${idx}`;

      return {
        _key: key,
        whenText,
        status,
        id: id || "-",
        patientName,
        patientId,
        doctorName,
        doctorId,
        location,
        subject,
      };
    });
  }, [results]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 14, fontWeight: 700 }}>預約查詢（請輸入身分證字號）</label>
          <input
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            placeholder="e.g., B123456789"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #ccc",
              minWidth: 220,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 800,
            background: "#2E7D32",
            color: "white",
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>

        <button
          onClick={() => {
            setPid("");
            setResults([]);
            setError("");
          }}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: 700,
            background: "white",
          }}
        >
          Clear
        </button>
      </div>

      {error && <div style={{ marginTop: 12, color: "#b71c1c", fontWeight: 700 }}>{error}</div>}

      <div style={{ marginTop: 14 }}>
        {viewResults.length > 0 && (
          <div style={{ fontSize: 14, color: "#555", marginBottom: 8 }}>
            Found <b>{viewResults.length}</b> appointment(s).
          </div>
        )}

        {viewResults.map((appt) => (
          <div
            key={appt._key}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
              background: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{appt.whenText}</div>
              <div
                style={{
                  fontWeight: 800,
                  color: String(appt.status).toUpperCase().includes("PENDING") ? "orange" : "#2E7D32",
                }}
              >
                {appt.status}
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              <div><b>Appointment ID:</b> {appt.id}</div>
              <div><b>Patient:</b> {appt.patientName} ({appt.patientId})</div>
              <div><b>Subject:</b> {appt.subject}</div>
              <div><b>Doctor:</b> {appt.doctorName} ({appt.doctorId})</div>
              <div><b>Location:</b> {appt.location}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}