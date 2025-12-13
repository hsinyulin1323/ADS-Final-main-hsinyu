import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from "react-leaflet";
import L from "leaflet";
import RoutingMachine from "./RoutingMachine";
import "./main.css";
import img from "./asset/image/heartbeeeat.jpg";
import carImg from "./asset/image/ambulance_15533330.svg";

import DoctorInboxWidget from "./pages/DoctorInboxWidget";
import DoctorConfirmModal from "./pages/DoctorConfirmModal";
import { useAppointments } from "./state/AppointmentContext";

// ===== Leaflet icon fix =====
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const carIcon = new L.Icon({
  iconUrl: carImg,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

export default function Main() {
  // ✅ Context：只取一次！不要再重複 useAppointments()
const apptCtx = useAppointments() || {};

const pending = useMemo(
  () => (Array.isArray(apptCtx.pending) ? apptCtx.pending : []),
  [apptCtx.pending]
);

const confirmed = useMemo(
  () => (Array.isArray(apptCtx.confirmed) ? apptCtx.confirmed : []),
  [apptCtx.confirmed]
);
  const confirmAppointment = apptCtx.confirmAppointment;
  const deleteAppointment = apptCtx.deleteAppointment;

  // ===== UI state =====
  const [activePanel, setActivePanel] = useState("dashboard"); // dashboard | confirm
  const [confirmTarget, setConfirmTarget] = useState(null); // ⭐ Review 的那筆 pending

  // ===== existing backend states =====
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]); // 後端 schedule（醫生端）
  const [alternatives, setAlternatives] = useState(null);
  const [backupCars, setBackupCars] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [routePath, setRoutePath] = useState([]);

  // ===== doctor modal (add/edit doctor) =====
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", id: "", status: "Available" });
  const [editingDocId, setEditingDocId] = useState(null);
  const [showConfirmWorkspace, setShowConfirmWorkspace] = useState(false);


  // ===== dispatch inputs =====
  const [targetAppointId, setTargetAppointId] = useState("APP001");

  // ===== right side event form =====
  const [showAppointForm, setShowAppointForm] = useState(false);
  const [editingAppointId, setEditingAppointId] = useState(null);
  const [appointForm, setAppointForm] = useState({
    appointId: "",
    patientId: "",
    doctorId: "",
    time: "",
    duration: "",
  });

  // ===== doctor selection modal =====
  const [showDocSelection, setShowDocSelection] = useState(false);
  const [availableDocs, setAvailableDocs] = useState([]);

  // ===== API =====
  const fetchDoctors = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/doctors");
      setDoctors(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/appointments");
      setAppointments(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRoute = async (doctorId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/route/${doctorId}`);
      const data = await res.json();
      setRoutePath(data);
    } catch (e) {
      console.error("路徑抓取失敗", e);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchAppointments();
  }, []);

  useEffect(() => {
    if (selectedDoctor) fetchRoute(selectedDoctor.id);
    else setRoutePath([]);
  }, [selectedDoctor]);

  // ===== dispatch =====
  const handleFindAlternatives = async () => {
    if (!targetAppointId) return alert("請輸入預約 ID");
    try {
      const response = await fetch(
        `http://localhost:5001/api/appointments/${targetAppointId}/alternatives`
      );
      const data = await response.json();
      setAlternatives(data.info);
      alert("已找到替代方案（demo），可查看 Console");
      console.log("Alternative Graph:", data.graph);
    } catch (error) {
      alert("找替代醫生失敗");
    }
  };

  const handleFindBackupCars = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/cars/backup");
      const data = await res.json();
      setBackupCars(data.available_cars || []);
    } catch (e) {
      console.error(e);
    }
  };

  // ===== doctor CRUD =====
  const openDocModal = (doc = null) => {
    if (doc) {
      setDocForm({ name: doc.name, id: doc.id, status: doc.status });
      setEditingDocId(doc.id);
    } else {
      setDocForm({ name: "", id: "", status: "Available" });
      setEditingDocId(null);
    }
    setShowDocModal(true);
  };

  const handleDocSubmit = async () => {
    if (!docForm.name || !docForm.id) return alert("請輸入完整資料");
    const url = editingDocId
      ? `http://localhost:5001/api/doctors/${editingDocId}`
      : "http://localhost:5001/api/doctors";
    const method = editingDocId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      if (res.ok) {
        alert((await res.json()).message);
        setShowDocModal(false);
        fetchDoctors();
      }
    } catch (e) {
      alert("操作失敗");
    }
  };

  const handleDeleteDoc = async (targetId, e) => {
    e.stopPropagation();
    if (!window.confirm(`確定刪除?`)) return;
    await fetch(`http://localhost:5001/api/doctors/${targetId}`, { method: "DELETE" });
    fetchDoctors();
  };

  // ===== appointment CRUD (backend) =====
  const handleEditAppointClick = (appt) => {
    setAppointForm({
      appointId: appt.id,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      time: appt.time || appt.scheduledAt || "",
      duration: appt.duration || "",
    });
    setEditingAppointId(appt.id);
    setShowAppointForm(true);
  };

  const handleAppointSubmit = async () => {
    if (!appointForm.patientId || !appointForm.time) return alert("請至少填 Patient ID 和 Time！");

    if (appointForm.doctorId) {
      await createAppointment(appointForm.doctorId);
      return;
    }

    alert("正在計算真實路況與醫生行程，請稍候...");
    try {
      const res = await fetch("http://localhost:5001/api/find-available-doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: appointForm.patientId,
          newTime: appointForm.time,
          newDuration: appointForm.duration || 30,
        }),
      });
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("找不到可行醫生（衝突或交通不及）");
      } else {
        setAvailableDocs(data);
        setShowDocSelection(true);
      }
    } catch (e) {
      console.error(e);
      alert("搜尋失敗");
    }
  };

  const createAppointment = async (finalDocId) => {
    const url = editingAppointId
      ? `http://localhost:5001/api/appointments/${editingAppointId}`
      : "http://localhost:5001/api/appointments";
    const method = editingAppointId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...appointForm, doctorId: finalDocId }),
      });
      const result = await res.json();

      if (res.ok) {
        alert(result.message);
        setShowAppointForm(false);
        setShowDocSelection(false);
        setAppointForm({ appointId: "", patientId: "", doctorId: "", time: "", duration: "30" });
        setEditingAppointId(null);
        fetchAppointments();
      } else {
        alert("失敗: " + result.message);
      }
    } catch (error) {
      alert("連線錯誤");
    }
  };

  const handleDeleteBackendAppointment = async (apptId) => {
    if (!window.confirm(`確定刪除預約 ${apptId}?`)) return;
    try {
      const res = await fetch(`http://localhost:5001/api/appointments/${apptId}`, { method: "DELETE" });
      if (res.ok) {
        fetchAppointments();
        if (selectedDoctor) fetchRoute(selectedDoctor.id);
      }
    } catch (e) {
      alert("刪除失敗");
    }
  };

  // ===== merge confirmed (front) into schedule list (demo) =====
  const confirmedAsSchedule = useMemo(() => {
    return confirmed.map((a) => ({
      id: a.id,
      patientName: a.patientName,
      patientId: a.patientId,
      doctorId: null,
      doctorName: a.doctorName || selectedDoctor?.name || "Doctor",
      time: a.scheduledAt,
      scheduledAt: a.scheduledAt,
      location: a.location || "—",
      status: "Confirmed",
    }));
  }, [confirmed, selectedDoctor]);

  const mergedAppointments = useMemo(() => {
    const list = [...appointments, ...confirmedAsSchedule];
    return list;
  }, [appointments, confirmedAsSchedule]);

  const displayedAppointments = useMemo(() => {
    if (!selectedDoctor) return mergedAppointments;
    return mergedAppointments.filter(
      (app) => app.doctorId === selectedDoctor.id || app.doctorName === selectedDoctor.name
    );
  }, [mergedAppointments, selectedDoctor]);

  // ===== route segments =====
  const carSegment =
    routePath.length >= 2 && routePath[0].type === "Car" ? [routePath[0], routePath[1]] : [];
  const patientSegment =
    routePath.length >= 2 && routePath[0].type === "Car" ? routePath.slice(1) : routePath;

  return (
    <div className="main">
      {/* ✅ 大視窗 Confirm Modal（Review & Confirm 用） */}
      {confirmTarget && (
        <DoctorConfirmModal
          appointment={confirmTarget}
          doctorName={selectedDoctor?.name || "Doctor"}
          onClose={() => setConfirmTarget(null)}
          onConfirm={(priority) => {
            if (typeof confirmAppointment === "function") {
              confirmAppointment({
                id: confirmTarget.id,
                priority,
                doctorName: selectedDoctor?.name || "Doctor",
              });
            }
            setConfirmTarget(null);
          }}
          onDelete={() => {
            if (typeof deleteAppointment === "function") {
              deleteAppointment(confirmTarget.id);
            }
            setConfirmTarget(null);
          }}
        />
      )}

      {/* 醫生推薦選擇視窗 */}
      {showDocSelection && (
        <Overlay onClose={() => setShowDocSelection(false)}>
          <div style={overlayCardStyle}>
            <h3>Available Doctors</h3>
            <p style={{ fontSize: "0.9em", color: "#666" }}>Based on real-time traffic calculation 🚗</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {availableDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => createAppointment(doc.id)}
                  style={{
                    padding: 10,
                    border: "1px solid #ccc",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#f9f9f9",
                  }}
                >
                  <div>
                    <strong>{doc.name}</strong> ({doc.id})
                  </div>
                  <div style={{ fontSize: 12, color: doc.travelTime > 20 ? "orange" : "green" }}>
                    🚗 {doc.travelTime} min
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowDocSelection(false)} style={{ marginTop: 16, width: "100%", padding: 10 }}>
              Cancel
            </button>
          </div>
        </Overlay>
      )}

      {/* 醫生編輯/新增 Modal */}
      {showDocModal && (
        <Overlay onClose={() => setShowDocModal(false)}>
          <div style={{ ...overlayCardStyle, width: 320 }}>
            <h3 style={{ marginTop: 0 }}>{editingDocId ? "Edit Doctor" : "Add New Doctor"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={docForm.name}
                onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                placeholder="Name"
                style={{ padding: 8 }}
              />
              <input
                value={docForm.id}
                onChange={(e) => setDocForm({ ...docForm, id: e.target.value })}
                placeholder="ID"
                style={{ padding: 8 }}
              />
              <select
                value={docForm.status}
                onChange={(e) => setDocForm({ ...docForm, status: e.target.value })}
                style={{ padding: 8 }}
              >
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
                <option value="On Leave">On Leave</option>
              </select>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setShowDocModal(false)}>Cancel</button>
                <button
                  onClick={handleDocSubmit}
                  style={{ background: "#2E7D32", color: "white", border: "none", padding: "8px 10px", borderRadius: 8 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      <div className="flex-container" id="mainDisplay">
        {/* ===== Left sidebar ===== */}
        <div id="leftSideBar">
          <p style={{ fontWeight: "bold", fontSize: 24, marginBottom: 20 }}>MediCare</p>
          <div className="barIndexBlock">
            <div className="flex-container">
              <div className="indexIcon" />
              <p className="indexText">Dashboard</p>
            </div>
          </div>
          <div className="barIndexBlock">
            <div className="flex-container">
              <div className="indexIcon" />
              <p className="indexText">Appointments</p>
            </div>
          </div>
        </div>

        {/* ===== Mid ===== */}
        <div className="flex-container-vertical" id="midDisplay">
          <div id="midTopDisplay">
            <div className="flex-container">
              <div className="flex-container-vertical">
                <div id="midTopLeftDisplay">
                  <DoctorInboxWidget
                    pendingCount={pending.length}
                    scheduledCount={confirmed.length}
                    onClickPending={() => setShowConfirmWorkspace(true)}
                  />
                  <DoctorConfirmModal
                    open={showConfirmWorkspace}
                    doctorName={selectedDoctor?.name || "Doctor"}
                    onClose={() => setShowConfirmWorkspace(false)}
                  />

                  {activePanel === "confirm" && (
                    <ConfirmPanel
                      pending={pending}
                      onBack={() => setActivePanel("dashboard")}
                      onSelect={(appt) => setConfirmTarget(appt)} // ⭐ 開大視窗
                      onDelete={(id) => {
                        if (typeof deleteAppointment === "function") deleteAppointment(id);
                      }}
                    />
                  )}

                  {/* Doctor Status */}
                  <div
                    id="doctorStats"
                    style={{ display: "flex", flexDirection: "column", gap: 10, padding: 15, position: "relative" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: "bold", fontSize: "1.2em" }}>Doctor Status:</div>
                      <button
                        onClick={() => openDocModal()}
                        style={{
                          padding: "4px 8px",
                          backgroundColor: "#2E7D32",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: "0.9em",
                        }}
                      >
                        + Add
                      </button>
                    </div>

                    <div
                      style={{
                        maxHeight: 200,
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: "rgba(255,255,255,0.8)",
                      }}
                    >
                      {doctors.map((doc, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedDoctor(doc)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                            padding: 8,
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: "1.1em",
                            backgroundColor: selectedDoctor?.id === doc.id ? "#c8e6c9" : "transparent",
                            border: selectedDoctor?.id === doc.id ? "2px solid #2E7D32" : "1px solid transparent",
                          }}
                        >
                          <span>
                            {doc.name}
                            <small
                              style={{
                                fontSize: "0.8em",
                                marginLeft: 5,
                                color: doc.status === "Available" ? "green" : doc.status === "Busy" ? "orange" : "gray",
                              }}
                            >
                              {" "}
                              ({doc.status}){" "}
                            </small>
                          </span>

                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDocModal(doc);
                              }}
                              style={{ marginRight: 5, cursor: "pointer", fontSize: "0.9em", padding: "4px 8px" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteDoc(doc.id, e)}
                              style={{ color: "red", cursor: "pointer", fontSize: "0.9em", padding: "4px 8px" }}
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedDoctor && (
                      <div style={{ fontSize: "1em", color: "#2E7D32" }}>
                        Viewing Route: <b>{selectedDoctor.name}</b>
                        <button onClick={() => setSelectedDoctor(null)} style={{ marginLeft: 10, cursor: "pointer", padding: "2px 5px" }}>
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dispatch widgets */}
                  <div className="flex-container" style={{ marginTop: 10, gap: 10 }}>
                    <div id="pendingAppoint" style={{ flex: 1, padding: 10, backgroundColor: "#e3f2fd", borderRadius: 10 }}>
                      <p style={{ fontWeight: "bold", fontSize: "0.9em" }}>Doctor Conflict</p>
                      <input
                        type="text"
                        value={targetAppointId}
                        onChange={(e) => setTargetAppointId(e.target.value)}
                        style={{ width: 80, fontSize: "0.8em" }}
                      />
                      <button
                        onClick={handleFindAlternatives}
                        style={{ cursor: "pointer", backgroundColor: "#2196f3", color: "white", border: "none", borderRadius: 5, padding: 6, width: "100%", marginTop: 6 }}
                      >
                        Find Alternative
                      </button>
                      {alternatives?.alternatives?.length > 0 && (
                        <div style={{ fontSize: "0.8em", color: "green", marginTop: 6 }}>Rec: {alternatives.alternatives[0].name}</div>
                      )}
                    </div>

                    <div id="confirmSchedule" style={{ flex: 1, padding: 10, backgroundColor: "#fff3e0", borderRadius: 10 }}>
                      <p style={{ fontWeight: "bold", fontSize: "0.9em" }}>Car Status</p>
                      <button
                        onClick={handleFindBackupCars}
                        style={{ cursor: "pointer", backgroundColor: "#ff9800", color: "white", border: "none", borderRadius: 5, padding: 8, width: "100%" }}
                      >
                        Find Cars
                      </button>
                      {backupCars.length > 0 && <div style={{ fontSize: "0.8em", color: "green", marginTop: 6 }}>Avail: {backupCars.length}</div>}
                    </div>
                  </div>
                </div>
              </div>

              <div id="patientInfo">
                <p>Patient Monitoring</p>
                <img src={img} alt="heartbeat" style={{ width: "100%", borderRadius: 10 }} />
              </div>
            </div>
          </div>

          {/* Map */}
          <div id="trafficInfo" style={{ padding: 0, overflow: "hidden" }}>
            <MapContainer center={[24.137, 120.686]} zoom={13} style={{ height: "100%", width: "100%" }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Google Streets">
                  <TileLayer url="http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Google Satellite">
                  <TileLayer url="http://mt0.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
                </LayersControl.BaseLayer>
              </LayersControl>

              {routePath.map((stop, idx) => (
                <Marker key={idx} position={[stop.lat, stop.lng]} icon={stop.type === "Car" ? carIcon : new L.Icon.Default()}>
                  <Popup>
                    <b>{stop.name}</b>
                    <br />
                    {stop.type === "Car" ? "Current Position" : `Time: ${stop.time}`}
                  </Popup>
                </Marker>
              ))}

              {carSegment.length > 0 && <RoutingMachine routePoints={carSegment} color="red" />}
              {patientSegment.length > 0 && <RoutingMachine routePoints={patientSegment} color="#6FA1EC" />}
            </MapContainer>
          </div>
        </div>

        {/* ===== Right schedule ===== */}
        <div id="appointInfo" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
            <p style={{ fontSize: 22, fontWeight: "bold", margin: 0 }}>
              {selectedDoctor ? `${selectedDoctor.name}'s Schedule` : "All Schedule"}
            </p>

            <button
              onClick={() => {
                setShowAppointForm(!showAppointForm);
                setEditingAppointId(null);
                setAppointForm({ appointId: "", patientId: "", doctorId: "", time: "", duration: "" });
              }}
              style={{ padding: "5px 10px", backgroundColor: "#b71c1c", color: "white", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: "bold", fontSize: 14 }}
            >
              {showAppointForm ? "Cancel" : "+ Event"}
            </button>
          </div>

          {showAppointForm && (
            <div style={{ backgroundColor: "#ffebee", padding: 10, borderRadius: 10, marginBottom: 10, border: "2px solid #b71c1c" }}>
              <p style={{ marginTop: 0, fontWeight: "bold", fontSize: "0.9em", color: "#b71c1c" }}>
                {editingAppointId ? "Edit Event" : "New Event"}
              </p>

              <input
                placeholder="Patient ID (e.g., P001)"
                value={appointForm.patientId}
                onChange={(e) => setAppointForm({ ...appointForm, patientId: e.target.value })}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <input
                placeholder="Doctor ID (e.g., D001) (optional)"
                value={appointForm.doctorId}
                onChange={(e) => setAppointForm({ ...appointForm, doctorId: e.target.value })}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <input
                placeholder="Time (e.g., 2025-12-13T10:00)"
                value={appointForm.time}
                onChange={(e) => setAppointForm({ ...appointForm, time: e.target.value })}
                style={{ width: "100%", marginBottom: 6 }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>Duration:</span>
                <input
                  type="number"
                  value={appointForm.duration}
                  onChange={(e) => setAppointForm({ ...appointForm, duration: e.target.value })}
                  style={{ width: 80 }}
                />
                <span style={{ fontSize: 12 }}>min</span>
              </div>

              <button
                onClick={handleAppointSubmit}
                style={{ width: "100%", backgroundColor: "#b71c1c", color: "white", border: "none", padding: 8, cursor: "pointer" }}
              >
                {editingAppointId ? "Update" : "Confirm"}
              </button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", paddingRight: 5 }}>
            {displayedAppointments.length === 0 ? (
              <p style={{ color: "gray" }}>No appointments.</p>
            ) : (
              displayedAppointments.map((appt, i) => {
                const timeText = appt.time || appt.scheduledAt || "";
                const timeShort = timeText.includes("T")
                  ? timeText.split("T")[1]
                  : timeText.includes(" ")
                  ? timeText.split(" ")[1]
                  : timeText;

                const isPending = String(appt.status || "").toLowerCase().includes("pending");
                const isLocalCtx = String(appt.id || "").startsWith("APP_"); // 你 context 自己產的

                return (
                  <div key={i} style={{ display: "flex", marginBottom: 15, position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 10, width: 50 }}>
                      <div style={{ fontSize: 14, fontWeight: "bold" }}>{timeShort}</div>
                      <div style={{ width: 2, flex: 1, backgroundColor: "#333", marginTop: 5 }} />
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          backgroundColor: isPending ? "orange" : "#2E7D32",
                          position: "absolute",
                          top: 5,
                          left: 46,
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, border: "2px solid #333", borderRadius: 5, padding: 10, backgroundColor: "white", boxShadow: "2px 2px 0px #333", position: "relative" }}>
                      <div style={{ position: "absolute", top: 5, right: 5 }}>
                        <button
                          onClick={() => handleEditAppointClick(appt)}
                          style={{ background: "transparent", border: "none", color: "blue", fontWeight: "bold", cursor: "pointer", marginRight: 5 }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => {
                            if (isLocalCtx) {
                              if (window.confirm("Delete this appointment?") && typeof deleteAppointment === "function") deleteAppointment(appt.id);
                            } else {
                              handleDeleteBackendAppointment(appt.id);
                            }
                          }}
                          style={{ background: "transparent", border: "none", color: "red", fontWeight: "bold", cursor: "pointer" }}
                        >
                          X
                        </button>
                      </div>

                      <div style={{ fontWeight: "bold", fontSize: 18, borderBottom: "2px solid #333", paddingBottom: 5, marginBottom: 5 }}>
                        {appt.patientName || "Unknown Patient"}
                      </div>

                      <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                        <div>
                          <b>Dr:</b> {appt.doctorName || "—"}
                        </div>
                        <div>
                          <b>Status:</b> {appt.status || "—"}
                        </div>
                        <div>
                          <b>Loc:</b> {appt.location || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#888" }}>ID: {appt.id}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Confirm Panel (list only, review opens modal) =====
function ConfirmPanel({ pending, onBack, onSelect, onDelete }) {
  const sorted = [...pending].sort((a, b) =>
    String(a.scheduledAt || "").localeCompare(String(b.scheduledAt || ""))
  );

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "white", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 900 }}>Confirm Appointments</div>
        <button onClick={onBack}>Back</button>
      </div>

      {sorted.length === 0 ? (
        <div style={{ color: "#777" }}>No pending appointments.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
          {sorted.map((a) => (
            <ConfirmRow
              key={a.id}
              appt={a}
              onReview={() => onSelect(a)} // ⭐ 只做 review
              onDelete={() => {
                if (window.confirm("Delete this appointment?")) onDelete(a.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ appt, onReview, onDelete }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>
          {appt.patientName} ({appt.patientId}) · {appt.subject}
        </div>
        <div style={{ fontWeight: 800, color: "#b71c1c" }}>PENDING</div>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
        <div>
          <b>Time:</b> {String(appt.scheduledAt || "").replace("T", " ")}
        </div>
        <div>
          <b>Loc:</b> {appt.location || "—"}
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={onReview}
          style={{
            padding: "6px 10px",
            background: "#1565C0",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Review & Confirm
        </button>

        <button
          onClick={onDelete}
          style={{
            padding: "6px 10px",
            background: "#C62828",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ===== simple overlay helper =====
function Overlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

const overlayCardStyle = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  width: 420,
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};