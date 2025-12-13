import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const API_BASE = "http://localhost:5001";
const USE_DEMO_WHEN_EMPTY = true;

function buildDemoRequests(doctorSubject = "耳鼻喉科") {
  // 你要測試 route-sorted：就讓陣列順序代表「路徑規劃後排序」
  const baseDate = new Date();
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
  const dd = String(baseDate.getDate()).padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;

  const all = [
    {
      id: "REQ_DEMO_001",
      status: "PENDING",
      date,
      timeSlot: "AM", 
      subject: "耳鼻喉科",
      symptoms: "頭暈目眩持續三天",
      patient: {
        id: "B200000000",
        name: "Patient J",
        age: 55,
        blood_type: "O",
        rhesus: "Rh+",
        location: "台中市西屯區福興路87號",
        contact: "0963507937",
      },
    },
    {
      id: "REQ_DEMO_002",
      status: "PENDING",
      date,
      timeSlot: "AM", 
      subject: "耳鼻喉科",
      symptoms: "喉嚨痛 + 發燒 38.5°C",
      patient: {
        id: "B123456789",
        name: "Patient A",
        age: 23,
        blood_type: "A",
        rhesus: "Rh+",
        location: "新竹市東區光復路二段101號",
        contact: "0912345678",
      },
    },
    {
      id: "REQ_DEMO_003",
      status: "PENDING",
      date,
      timeSlot: "AM", 
      subject: "耳鼻喉科",
      symptoms: "耳鳴、聽力下降一週",
      patient: {
        id: "F223456789",
        name: "Patient B",
        age: 72,
        blood_type: "B",
        rhesus: "Rh-",
        location: "新竹縣竹北市成功八路66號",
        contact: "0988888888",
      },
    },
    {
      id: "REQ_DEMO_004",
      status: "PENDING",
      date,
      timeSlot: "PM", 
      subject: "眼科",
      symptoms: "眼睛刺痛、畏光",
      patient: {
        id: "A123000000",
        name: "Patient C",
        age: 34,
        blood_type: "AB",
        rhesus: "Rh+",
        location: "台北市大安區復興南路一段9號",
        contact: "0977000000",
      },
    },
    {
      id: "REQ_DEMO_005",
      status: "PENDING",
      date,
      timeSlot: "PM", 
      subject: "胸腔科",
      symptoms: "咳嗽帶痰兩週、夜間喘",
      patient: {
        id: "D111222333",
        name: "Patient D",
        age: 61,
        blood_type: "O",
        rhesus: "Rh-",
        location: "桃園市中壢區環中東路20號",
        contact: "0955111222",
      },
    },
  ];

  // 只回傳這位醫生科別的
  return all.filter((x) => x.subject === doctorSubject);
}


// ---------- helpers ----------
function slotLabel(slot) {
  return slot === "AM" ? "Morning (AM)" : slot === "PM" ? "Afternoon (PM)" : slot;
}

function normalizeId(v) {
  return String(v || "").trim();
}

// 把後端的 request row 轉成 UI 需要的格式
function toViewModel(row) {
  const patient = row.patient || {};
  return {
    // request id
    id: row.id,
    status: row.status || "PENDING",

    date: row.date || "",          // "YYYY-MM-DD"
    timeSlot: row.timeSlot || "",  // "AM" | "PM"
    subject: row.subject || "",
    symptoms: row.symptoms || "",

    // patient info
    patientId: patient.id || "",
    patientName: patient.name || "Unknown",
    age: patient.age ?? null,
    blood_type: patient.blood_type || "",
    rhesus: patient.rhesus || "",
    location: patient.location || "—",
    contact: patient.contact || "",

    // route order (目前先用 API 回傳順序)
    _routeRank: 0,
  };
}

// 顯示卡片文字
function patientTitle(a) {
  const age = a.age !== null && a.age !== undefined ? `${a.age}Y` : "—Y";
  const bt = [a.blood_type, a.rhesus].filter(Boolean).join(" ");
  return `${a.patientName} ${age} (${bt || "—"})`;
}

// ---------- DnD payload ----------
/**
 * payload = {
 *   from: "PENDING" | "AM" | "PM",
 *   id: "REQ...."
 * }
 */
function setDrag(e, payload) {
  e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}
function getDrag(e) {
  try {
    return JSON.parse(e.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
}
function allowDrop(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

// ---------- component ----------
export default function DoctorConfirmModal({
  open,
  doctorName = "Doctor J",
  doctorSubject = "", // 例如： "耳鼻喉科"
  onClose,
  onAcceptToBackend,  // async (payload) => {}
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 左：pending（priority=0，只是 route-sorted）
  const [pending, setPending] = useState([]);

  // 右：schedule（AM / PM，priority=1..n 由順序決定）
  const [scheduleAM, setScheduleAM] = useState([]);
  const [schedulePM, setSchedulePM] = useState([]);

  // 讀取 pending request（只拿同科別）
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");

      try {
        // ✅ 先打後端 route（方法一）
        const res = await fetch(
          `${API_BASE}/api/appointment-requests?status=PENDING`
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);

        const rows = await res.json();
        const arr = Array.isArray(rows) ? rows : [];

        // ✅ filter by subject -> doctorSubject
        const filtered = arr
          .map(toViewModel)
          .filter((x) => (doctorSubject ? x.subject === doctorSubject : true))
          .map((x, idx) => ({ ...x, _routeRank: idx + 1 })); // 以 API 回傳順序當 route rank

        if (cancelled) return;

        // ✅ 如果後端回來是空的，就用 demo（可關掉 USE_DEMO_WHEN_EMPTY）
        if (USE_DEMO_WHEN_EMPTY && filtered.length === 0) {
          const demo = buildDemoRequests(doctorSubject || "耳鼻喉科")
            .map(toViewModel)
            .map((x, idx) => ({ ...x, _routeRank: idx + 1 }));
          setPending(demo);
        } else {
          setPending(filtered);
        }

        // ✅ 每次打開 modal：先清空 schedule，讓醫生自己拖
        setScheduleAM([]);
        setSchedulePM([]);
      } catch (e) {
        console.error(e);

        // ✅ API 掛了也可以用 demo 讓你繼續做 UI 操作
        if (!cancelled && USE_DEMO_WHEN_EMPTY) {
          const demo = buildDemoRequests(doctorSubject || "耳鼻喉科")
            .map(toViewModel)
            .map((x, idx) => ({ ...x, _routeRank: idx + 1 }));
          setPending(demo);
          setScheduleAM([]);
          setSchedulePM([]);
          setErr("Using demo data.");
        } else if (!cancelled) {
          setErr("Failed to load pending appointments.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, doctorSubject]);

  // 右側 priority 自動重算（顯示用）
  const scheduleAMWithPriority = useMemo(
    () => scheduleAM.map((a, i) => ({ ...a, priority: i + 1, assignedSlot: "AM" })),
    [scheduleAM]
  );
  const schedulePMWithPriority = useMemo(
    () => schedulePM.map((a, i) => ({ ...a, priority: i + 1, assignedSlot: "PM" })),
    [schedulePM]
  );

  // 讓 pending 永遠 priority=0（顯示用）
  const pendingView = useMemo(
    () => pending.map((a) => ({ ...a, priority: 0 })),
    [pending]
  );

  // 從 list 找到某個 item
  function findInLists(id) {
    const inPending = pending.find((x) => x.id === id);
    const inAM = scheduleAM.find((x) => x.id === id);
    const inPM = schedulePM.find((x) => x.id === id);
    return { inPending, inAM, inPM };
  }

  // 把 item 從某個 list 移除
  function removeFrom(from, id) {
    if (from === "PENDING") setPending((prev) => prev.filter((x) => x.id !== id));
    if (from === "AM") setScheduleAM((prev) => prev.filter((x) => x.id !== id));
    if (from === "PM") setSchedulePM((prev) => prev.filter((x) => x.id !== id));
  }

  // 插入到某個 schedule list 指定 index
  function insertTo(to, item, index = null) {
    if (to === "AM") {
      setScheduleAM((prev) => {
        const next = [...prev];
        const idx = index === null ? next.length : Math.max(0, Math.min(next.length, index));
        next.splice(idx, 0, item);
        return next;
      });
    }
    if (to === "PM") {
      setSchedulePM((prev) => {
        const next = [...prev];
        const idx = index === null ? next.length : Math.max(0, Math.min(next.length, index));
        next.splice(idx, 0, item);
        return next;
      });
    }
  }

  // Drop 到 schedule 區塊（list-level drop：丟進最後）
  function onDropToList(e, to) {
    e.preventDefault();
    const payload = getDrag(e);
    if (!payload?.id || !payload?.from) return;

    const { id, from } = payload;
    if (from === to) return;

    const { inPending, inAM, inPM } = findInLists(id);
    const item = inPending || inAM || inPM;
    if (!item) return;
    // ✅ 只能丟到自己選的時段
    // e.g. item.timeSlot === "AM" 就只能 drop 到 AM
    if (item.timeSlot && item.timeSlot !== to) {
      alert(`This appointment is ${slotLabel(item.timeSlot)}. Please drop it into the correct column.`);
      return;
    }

    removeFrom(from, id);
    insertTo(to, item, null);
  }

  // Drop 到 schedule 的「某一列」：插入到指定位置
  function onDropToRow(e, to, targetIndex) {
    e.preventDefault();
    const payload = getDrag(e);
    if (!payload?.id || !payload?.from) return;

    const { id, from } = payload;

    const { inPending, inAM, inPM } = findInLists(id);
    const item = inPending || inAM || inPM;
    if (!item) return;

    // ✅ 只能丟到自己選的時段
    if (item.timeSlot && item.timeSlot !== to) {
      alert(`This appointment is ${slotLabel(item.timeSlot)}. Please drop it into the correct column.`);
      return;
    }

    // 若同一 list 內 reorder：要先移除再插入（注意 index 修正）
    if (from === to) {
      if (to === "AM") {
        setScheduleAM((prev) => {
          const curIdx = prev.findIndex((x) => x.id === id);
          if (curIdx < 0) return prev;

          const next = [...prev];
          const [moved] = next.splice(curIdx, 1);

          // 如果原本在上面，移除後 targetIndex 會往上縮一格
          const corrected = curIdx < targetIndex ? targetIndex - 1 : targetIndex;
          next.splice(Math.max(0, Math.min(next.length, corrected)), 0, moved);
          return next;
        });
      }
      if (to === "PM") {
        setSchedulePM((prev) => {
          const curIdx = prev.findIndex((x) => x.id === id);
          if (curIdx < 0) return prev;

          const next = [...prev];
          const [moved] = next.splice(curIdx, 1);
          const corrected = curIdx < targetIndex ? targetIndex - 1 : targetIndex;
          next.splice(Math.max(0, Math.min(next.length, corrected)), 0, moved);
          return next;
        });
      }
      return;
    }

    // 不同 list：先移除原 list，再插入新 list 指定位置
    removeFrom(from, id);
    insertTo(to, item, targetIndex);
  }
  function onDropToPending(e) {
    e.preventDefault();
    const payload = getDrag(e);
    if (!payload?.id || !payload?.from) return;

    const { id, from } = payload;

    // 如果本來就在 pending，就不用做事
    if (from === "PENDING") return;

    const { inPending, inAM, inPM } = findInLists(id);
    const item = inAM || inPM || inPending;
    if (!item) return;

    // 從原本的 list 移除
    removeFrom(from, id);

    // 放回 pending（priority = 0）
    setPending((prev) => [
        ...prev,
        {
        ...item,
        priority: 0,
        },
    ]);
  }
  async function handleAccept() {
    // 你最後要傳回後端的 payload
    // 目前先整理成「doctor + subject + date + AM/PM priorities」
    const payload = {
      doctorName,
      doctorSubject,
      confirmedAt: new Date().toISOString(),
      schedule: {
        AM: scheduleAMWithPriority.map((a) => ({
          requestId: a.id,
          priority: a.priority,
          date: a.date,
          timeSlot: "AM",
          subject: a.subject,
          symptoms: a.symptoms,
          patientId: a.patientId,
        })),
        PM: schedulePMWithPriority.map((a) => ({
          requestId: a.id,
          priority: a.priority,
          date: a.date,
          timeSlot: "PM",
          subject: a.subject,
          symptoms: a.symptoms,
          patientId: a.patientId,
        })),
      },
    };

    // 你之後接 server.js：把 request 轉成正式 Appointment / ASSIGNED_TO / etc.
    if (typeof onAcceptToBackend === "function") {
      await onAcceptToBackend(payload);
    }

    onClose?.();
  }

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 18,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(1400px, 95vw)",
          height: "min(86vh, 920px)",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            {doctorName}’s Scheduler{" "}
            <span style={{ opacity: 0.7 }}>
              {doctorSubject ? `· ${doctorSubject}` : ""}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                border: "none",
                background: "#eee",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              ✕ Close
            </button>

            <button
              onClick={handleAccept}
              style={{
                border: "none",
                background: "#2E7D32",
                color: "white",
                padding: "8px 12px",
                borderRadius: 10,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              ACCEPT
            </button>
          </div>
        </div>

        {/* body */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "420px 1fr",
            overflow: "hidden",
          }}
        >
          {/* left: Pending */}
          <div style={{ borderRight: "1px solid #eee", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #eee", fontWeight: 900 }}>
              Appointments (Pending) <span style={{ opacity: 0.6 }}>(priority = 0, route-sorted)</span>
            </div>

            <div
              onDragOver={allowDrop}
              onDrop={(e) => onDropToPending(e)}
              style={{
                padding: 14,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {loading ? <div>Loading…</div> : null}
              {err ? <div style={{ color: "#b71c1c", fontWeight: 800 }}>{err}</div> : null}

              {!loading && !err && pendingView.length === 0 ? (
                <div style={{ color: "#777" }}>No pending appointments for this subject.</div>
              ) : (
                pendingView.map((a) => (
                  <Card
                    key={a.id}
                    appt={a}
                    badgeLeft={`Route #${a._routeRank} · ${slotLabel(a.timeSlot)}`} 
                    badgeRight={"P0"}
                    draggable
                    onDragStart={(e) => setDrag(e, { from: "PENDING", id: a.id })}
                  />
                ))
              )}
            </div>
          </div>

          {/* right: Schedule AM / PM */}
          <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 14, borderBottom: "1px solid #eee", fontWeight: 900 }}>
              Schedule (doctor decides priority 1..n)
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <ScheduleColumn
                title="Morning (AM)"
                slot="AM"
                items={scheduleAMWithPriority}
                onDropToList={onDropToList}
                onDropToRow={onDropToRow}
              />

              <ScheduleColumn
                title="Afternoon (PM)"
                slot="PM"
                items={schedulePMWithPriority}
                onDropToList={onDropToList}
                onDropToRow={onDropToRow}
              />
            </div>

            <div style={{ padding: "10px 14px", borderTop: "1px solid #eee", fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              ✅ Pending 是 route-sorted 的初始建議順序（priority=0）。<br />
              ✅ 拖曳到 AM/PM 後，該時段內會自動變成 priority 1..n（依你排列順序）。<br />
              ✅ AM/PM 內拖曳可調整順序；也可以 AM ↔ PM 移動。
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------- UI components ----------
function ScheduleColumn({ title, slot, items, onDropToList, onDropToRow }) {
  return (
    <div
      onDragOver={allowDrop}
      onDrop={(e) => onDropToList(e, slot)}
      style={{
        border: "1px solid #ddd",
        borderRadius: 14,
        background: "#fafafa",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 360,
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid #e5e5e5", fontWeight: 900, display: "flex", justifyContent: "space-between" }}>
        <div>{title}</div>
        <div style={{ fontWeight: 800, color: "#555" }}>{items.length} items</div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 ? (
          <div style={{ color: "#999", padding: 10, border: "1px dashed #bbb", borderRadius: 12 }}>
            Drop here
          </div>
        ) : (
          items.map((a, idx) => (
            <div
              key={a.id}
              onDragOver={allowDrop}
              onDrop={(e) => onDropToRow(e, slot, idx)}
            >
              <Card
                appt={a}
                badgeLeft={`${slotLabel(slot)}`}
                badgeRight={`P${a.priority}`}
                draggable
                onDragStart={(e) => setDrag(e, { from: slot, id: a.id })}
              />
            </div>
          ))
        )}

        {/* drop to end */}
        {items.length > 0 ? (
          <div
            onDragOver={allowDrop}
            onDrop={(e) => onDropToRow(e, slot, items.length)}
            style={{
              height: 34,
              borderRadius: 12,
              border: "1px dashed #bbb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontWeight: 800,
            }}
          >
            Drop to end
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Card({ appt, badgeLeft, badgeRight, draggable, onDragStart }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      style={{
        border: "1px solid #ddd",
        borderRadius: 14,
        padding: 12,
        background: "white",
        boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        cursor: draggable ? "grab" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {patientTitle(appt)}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {badgeLeft ? (
            <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "#eee" }}>
              {badgeLeft}
            </span>
          ) : null}
          {badgeRight ? (
            <span style={{ fontSize: 12, fontWeight: 900, padding: "4px 8px", borderRadius: 999, background: "#E8F5E9", color: "#2E7D32" }}>
              {badgeRight}
            </span>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, color: "#333", lineHeight: 1.55 }}>
        <div><b>Loc:</b> {appt.location || "—"}</div>
        <div><b>Symptom:</b> {appt.symptoms || "—"}</div>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
        <b>Date:</b> {appt.date || "—"} · <b>Subject:</b> {appt.subject || "—"}
      </div>
    </div>
  );
}