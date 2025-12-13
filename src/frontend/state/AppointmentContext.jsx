import React, { createContext, useContext, useMemo, useState } from "react";

const AppointmentContext = createContext(null);

export function AppointmentProvider({ children }) {
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [confirmedAppointments, setConfirmedAppointments] = useState([]);

  // 病人送出 → pending（priority=0）
  // 病人送出 → pending（priority=0）
const addPending = (payload) => {
  const localId = `PENDING-${Date.now()}`;

  const appt = payload?.appointment || {};
  const patient = payload?.patient || {};

  const newAppt = {
    _localId: localId,
    id: localId, // ✅ 很多地方用 id，直接給它
    status: "PENDING",
    priority: 0,

    // ✅ 攤平常用欄位（給 ConfirmRow / DoctorConfirmModal 用）
    patientName: patient.name || "",
    patientId: patient.id || patient.patientId || "",
    subject: appt.subject || "",
    date: appt.scheduledAt || appt.date || "",      // 你目前用 scheduledAt 當 date
    timeSlot: appt.timeSlot || "",
    slotStart: appt.slotStart || null,
    slotEnd: appt.slotEnd || null,
    symptoms: appt.symptoms || "",
    location: patient.loc || payload?.location?.addressText || "",

    // 保留原始 payload（之後要送後端再用）
    raw: payload,
    createdAt: appt.createdAt || new Date().toISOString(),
  };

  setPendingAppointments((prev) => [...prev, newAppt]);
  return localId;
};

  /**
   * ✅ 醫生確認
   * 支援兩種呼叫方式：
   * 1) confirmAppointment(localId, priority, doctorName?)
   * 2) confirmAppointment({ id, priority, doctorName?, scheduledAt? })
   */
  const confirmAppointment = (...args) => {
    const isObjectStyle = args.length === 1 && typeof args[0] === "object" && args[0] !== null;

    const localId = isObjectStyle ? args[0].id : args[0];
    const priority = isObjectStyle ? args[0].priority : args[1];
    const doctorName = isObjectStyle ? args[0].doctorName : args[2];
    const scheduledAtOverride = isObjectStyle ? args[0].scheduledAt : undefined;

    let confirmed = null;

    setPendingAppointments((prev) => {
      const target = prev.find((a) => a._localId === localId || a.id === localId);
      if (!target) return prev;

      confirmed = {
        ...target,
        status: "CONFIRMED",
        priority: Number(priority) || 3,
        doctorName: doctorName || target.doctorName || "Dr. Assigned",
        confirmedAt: new Date().toISOString(),
      };

      // 如果 modal 已經把時間重新排到某個 slot，可以覆蓋 appointment.scheduledAt
      if (scheduledAtOverride) {
        confirmed.appointment = {
          ...(confirmed.appointment || {}),
          scheduledAt: scheduledAtOverride,
        };
      }

      return prev.filter((a) => (a._localId || a.id) !== (target._localId || target.id));
    });

    if (confirmed) {
      setConfirmedAppointments((prev) => [...prev, confirmed]);
    }
  };

  /**
   * ✅ 刪除（pending / confirmed 都支援）
   * id 可傳 _localId 或 appointment id（你目前主要用 _localId）
   */
  const deleteAppointment = (id) => {
    setPendingAppointments((prev) => prev.filter((a) => (a._localId || a.id) !== id));
    setConfirmedAppointments((prev) => prev.filter((a) => (a._localId || a.id) !== id));
  };

  const value = useMemo(
    () => ({
      pendingAppointments,
      confirmedAppointments,
      pending: pendingAppointments,     // alias
      confirmed: confirmedAppointments, // alias
      addPending,
      confirmAppointment,
      deleteAppointment,
    }),
    [pendingAppointments, confirmedAppointments]
  );

  return <AppointmentContext.Provider value={value}>{children}</AppointmentContext.Provider>;
}

export function useAppointments() {
  const ctx = useContext(AppointmentContext);
  if (!ctx) throw new Error("useAppointments must be used within AppointmentProvider");
  return ctx;
}