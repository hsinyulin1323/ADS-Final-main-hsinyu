import { NavLink } from "react-router-dom";

import MakeAppointment from "./MakeAppointment";
import QueryAppointment from "./QueryAppointment";
import AppointmentList from "./AppointmentList";
import Sidebar from "../components/Sidebar_Patient"; 
import "../main.css";

export default function PatientMain() {
  return (
    <div className="main">
      <div className="flex-container" id="mainDisplay">
        {/* ===== Left sidebar ===== */}
        <Sidebar dashboardTo="/patient" />
        {/* ===== Right content (Top: MakeAppointment auto height, Bottom: query uses remaining) ===== */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 16,
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          {/* ✅ Top: MakeAppointment（依內容高度） */}
          <section
            style={{
              ...panelStyle,
              flex: "0 0 auto",   // ✅ 不要撐滿，依內容
              overflow: "visible" // ✅ 讓內容自然長
            }}
          >
            <MakeAppointment />
          </section>

          {/* ✅ Bottom: Query + My appointments（吃剩下空間，可滾） */}
          <section
            style={{
              ...panelStyle,
              flex: 1,        // ✅ 吃剩下的畫面
              minHeight: 0,   // ✅ 讓 overflow 正常生效
              overflow: "auto"
            }}
          >
            <h2 style={{ marginBottom: 12 }}>預約查詢 / 我的預約</h2>

            <div style={{ marginBottom: 16 }}>
              <QueryAppointment />
            </div>

            <div style={{ marginTop: 8 }}>
              <AppointmentList />
            </div>
          </section>
        </div>
        
      </div>
    </div>
  );
}

/** ===== sidebar components ===== */
function SideNavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        ...sideItemStyle,
        background: isActive ? "#E9ECEF" : "transparent", // ✅ active 加深底色
      })}
    >
      <img src={icon} alt="" style={sideIconStyle} />
      <span style={sideTextStyle}>{label}</span>
    </NavLink>
  );
}

function SideExternalItem({ href, icon, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={sideItemStyle}
    >
      <img src={icon} alt="" style={sideIconStyle} />
      <span style={sideTextStyle}>{label}</span>
    </a>
  );
}

/** ===== styles ===== */
const navItemStyle = ({ isActive }) => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: 12,
  textDecoration: "none",
  fontWeight: 800,
  color: isActive ? "white" : "#333",
  background: isActive ? "#2E7D32" : "transparent",
  marginBottom: 8,
});

const panelStyle = {
  background: "white",
  borderRadius: 12,
  border: "1px solid #ddd",
  padding: 16,
  overflow: "auto", // top panel 可以滾，bottom 我們已改 hidden
  minHeight: 0,
};

const sideItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 12px",
  borderRadius: 14,
  textDecoration: "none",
  color: "#222",
  fontWeight: 800,
  marginBottom: 10,
};

const sideIconStyle = {
  width: 22,
  height: 22,
  objectFit: "contain",
  flexShrink: 0,
  opacity: 0.9,
};

const sideTextStyle = {
  fontSize: 16,
  lineHeight: 1,
};