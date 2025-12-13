import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppointments } from "../state/AppointmentContext";

const SUBJECT_OPTIONS = ["眼科", "耳鼻喉科", "胸腔科", "神經外科", "泌尿科"];
const SLOT_OPTIONS = [
  { value: "AM", label: "上午 (09:00–12:00)", start: "09:00", end: "12:00" },
  { value: "PM", label: "下午 (13:00–17:00)", start: "13:00", end: "17:00" },
];

function normalizePid(value) {
  return value.toUpperCase();
}

// ✅ 身分證字號（台灣）常見格式：1個英文 + 9個數字
// 例：B200000000
function isValidTWId(id) {
  return /^[A-Z][0-9]{9}$/.test(id);
}

function todayDateString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 改成時段描述
function combineDateSlot(dateStr, slot) {
  if (!dateStr || !slot) return "";
  const label = slot === "AM" ? "上午" : "下午";
  return `${dateStr} ${label}`;
}

export default function MakeAppointment({ onSubmitAppointment }) {
  const navigate = useNavigate();
  const { addPending } = useAppointments();

  const [form, setForm] = useState({
    patientName: "",
    patientId: "", // 身分證字號 e.g. B200000000
    date: "",
    slot: "", // AM / PM
    subject: "",
    symptoms: "",
  });

  const [touched, setTouched] = useState({});
  const [submitStatus, setSubmitStatus] = useState({ type: "", message: "" });

  const apptDateSlot = useMemo(
    () => combineDateSlot(form.date, form.slot),
    [form.date, form.slot]
  );

  const errors = useMemo(() => {
    const e = {};

    if (!form.patientName.trim()) e.patientName = "必填：病人姓名";

    if (!form.patientId.trim()) e.patientId = "必填：身分證字號（例如 B200000000）";
    else if (!isValidTWId(form.patientId.trim()))
      e.patientId = "格式錯誤：請用 1個大寫英文 + 9位數字（例如 B200000000）";

    if (!form.date) e.date = "必填：預約日期";
    if (!form.slot) e.slot = "必填：看診時段（上午/下午）";
    if (!form.subject) e.subject = "必填：預約科別";

    if (!form.symptoms.trim()) e.symptoms = "必填：症狀描述";

    return e;
  }, [form]);

  const isFormValid = Object.keys(errors).length === 0;
  const fieldError = (key) => (touched[key] ? errors[key] : "");

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "patientId") {
      updateField(name, normalizePid(value));
      return;
    }
    updateField(name, value);
  }

  function handleBlur(e) {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    setTouched({
      patientName: true,
      patientId: true,
      date: true,
      slot: true,
      subject: true,
      symptoms: true,
    });

    if (!isFormValid) {
      setSubmitStatus({ type: "error", message: "表單有欄位未完成或格式錯誤。" });
      return;
    }

    const slotMeta = SLOT_OPTIONS.find((s) => s.value === form.slot);

    // ✅ payload：把 slot & symptoms 帶出去
    // 你之後接後端時，可以用 date + slotMeta(start/end) 去排程
    const payload = {
      appointment: {
        appointmentId: null,
        status: "PENDING",
        subject: form.subject,
        // 這裡改成「日期 + 時段」，避免假裝有精確時間
        date: form.date,
        scheduledAt: form.date, // 先保留 date 給系統用
        timeSlot: form.slot, // AM / PM
        slotStart: slotMeta?.start || null,
        slotEnd: slotMeta?.end || null,
        symptoms: form.symptoms.trim(),
        createdAt: new Date().toISOString(),
      },
      patient: {
        id: form.patientId.trim(), // 身分證字號
        name: form.patientName.trim(),
        // rhesus, blood_type, age, loc 你說先不改這裡，之後有資料再補
      },
      routing: {
        estimatedDistanceKm: null,
        estimatedTravelTimeMin: null,
        routePolyline: null,
      },
      graphRef: {
        patientNodeId: null,
        locationNodeId: null,
        doctorNodeId: null,
      },
    };

    console.log("✅ New Appointment Payload:", payload);

    if (typeof onSubmitAppointment === "function") {
      onSubmitAppointment(payload);
    }

    const apptId = addPending(payload);

    setSubmitStatus({ type: "success", message: "已送出預約（目前為前端模擬）" });

    navigate("/patient/confirm", { state: { ...payload, _localApptId: apptId } });

    // reset
    setForm({
      patientName: "",
      patientId: "",
      date: "",
      slot: "",
      subject: "",
      symptoms: "",
    });
    setTouched({});
  }

  return (
    <div style={{ display: "flex", gap: 16, height: "100%" }}>
      {/* 左：表單 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ marginBottom: 12 }}>新增預約</h2>

        {submitStatus.message ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
              background: submitStatus.type === "success" ? "#E8F5E9" : "#FFEBEE",
            }}
          >
            {submitStatus.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <FieldRow label="病人姓名" required error={fieldError("patientName")}>
            <input
              name="patientName"
              value={form.patientName}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="例如：張藝興"
              style={inputStyle}
            />
          </FieldRow>

          <FieldRow label="身分證字號" required error={fieldError("patientId")}>
            <input
              name="patientId"
              value={form.patientId}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="例如：B123456789"
              style={inputStyle}
            />
          </FieldRow>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <FieldRow label="預約日期" required error={fieldError("date")}>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  min={todayDateString()}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={inputStyle}
                />
              </FieldRow>
            </div>

            <div style={{ flex: 1 }}>
              <FieldRow label="看診時段" required error={fieldError("slot")}>
                <select
                  name="slot"
                  value={form.slot}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={inputStyle}
                >
                  <option value="">請選擇</option>
                  {SLOT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>
          </div>

          <FieldRow label="預約科別" required error={fieldError("subject")}>
            <select
              name="subject"
              value={form.subject}
              onChange={handleChange}
              onBlur={handleBlur}
              style={inputStyle}
            >
              <option value="">請選擇</option>
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="症狀描述" required error={fieldError("symptoms")}>
            <textarea
              name="symptoms"
              value={form.symptoms}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="請描述主要症狀、持續多久"
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </FieldRow>

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button type="submit" disabled={!isFormValid} style={buttonStyle}>
              送出預約
            </button>

            <button
              type="button"
              onClick={() => {
                setForm({
                  patientName: "",
                  patientId: "",
                  date: "",
                  slot: "",
                  subject: "",
                  symptoms: "",
                });
                setTouched({});
                setSubmitStatus({ type: "", message: "" });
              }}
              style={{ ...buttonStyle, background: "#eee" }}
            >
              清空
            </button>
          </div>
        </form>
      </div>

      {/* 右：即時預覽 */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <h3 style={{ marginBottom: 12 }}>預覽</h3>
        <div style={previewCardStyle}>
          <Line
            label="病人"
            value={`${form.patientName || "—"} (${form.patientId || "—"})`}
          />
          <Line label="時段" value={apptDateSlot || "—"} />
          <Line label="科別" value={form.subject || "—"} />
          <Line label="症狀" value={form.symptoms?.trim() ? form.symptoms : "—"} />
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <label style={{ fontWeight: 600 }}>
          {label} {required ? <span style={{ color: "#C62828" }}>*</span> : null}
        </label>
        {error ? (
          <span style={{ color: "#C62828", fontSize: 12 }}>{error}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
};

const previewCardStyle = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid #ddd",
  background: "#fff",
};