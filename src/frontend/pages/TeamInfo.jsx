import React from "react";
import "../main.css";

import SidebarPatient from "../components/Sidebar_Patient";
import SidebarDoctor from "../components/Sidebar_Doctor";

import doctorA from "../asset/image/doctor_A.png";
import doctorB from "../asset/image/doctor_B.png";
import doctorC from "../asset/image/doctor_C.png";
import doctorD from "../asset/image/doctor_D.png";
import doctorE from "../asset/image/doctor_E.png";
import nurseImg from "../asset/image/nurse.png";

const doctors = [
  { name: "曾國城", dept: "胸腔科", phone: "0922123123", img: doctorA },
  { name: "張藝興", dept: "神經外科", phone: "0922123456", img: doctorB },
  { name: "顧北辰", dept: "耳鼻喉科", phone: "0911123789", img: doctorC },
  { name: "王大陸", dept: "泌尿科", phone: "0933123789", img: doctorD },
  { name: "蕭煌奇", dept: "眼科", phone: "0944123789", img: doctorE },
];

const nurses = [
  { name: "劉怡玫" },
  { name: "余春蓉" },
  { name: "吳佳情" },
  { name: "葉逸萱" },
  { name: "許少牟" },
].map((n) => ({ ...n, dept: "居家醫療護理人員", phone: "—", img: nurseImg }));

function PersonCard({ img, name, dept, phone }) {
  return (
    <div style={cardStyle}>
      <img src={img} alt={name} style={avatarStyle} />
      <div style={titleStyle}>{name}</div>
      <div style={subtitleStyle}>{dept}</div>
      <div style={linesWrapperStyle}>
        <div style={lineItemStyle}>
          <b>Phone:</b> {phone}
        </div>
      </div>
    </div>
  );
}

export default function TeamInfo({ variant = "doctor" }) {
  // ✅ 依入口決定 Sidebar
  const Sidebar = variant === "patient" ? SidebarPatient : SidebarDoctor;

  // ✅ 依入口決定 Dashboard 要回哪裡
  const dashboardTo = variant === "patient" ? "/patient" : "/";

  return (
    <div className="main">
      <div className="flex-container" id="mainDisplay">
        {/* Left sidebar */}
        <Sidebar brand="GoooodEar" dashboardTo={dashboardTo} />

        {/* Right content */}
        <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
          <h2 style={{ marginBottom: 14 }}>Team Info</h2>

          <h3 style={{ margin: "18px 0 10px" }}>醫師資訊</h3>
          <div style={gridStyle}>
            {doctors.map((d) => (
              <PersonCard key={d.name} img={d.img} name={d.name} dept={d.dept} phone={d.phone} />
            ))}
          </div>

          <h3 style={{ margin: "24px 0 10px" }}>居家醫療護理人員</h3>
          <div style={gridStyle}>
            {nurses.map((n) => (
              <PersonCard key={n.name} img={n.img} name={n.name} dept={n.dept} phone={n.phone} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ===== styles ===== */
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 16,
};

const cardStyle = {
  border: "1px solid #e5e5e5",
  borderRadius: 24,
  padding: "22px 18px",
  background: "white",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
};

const avatarStyle = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid #f0f0f0",
  background: "#fafafa",
  marginBottom: 14,
};

const titleStyle = { fontWeight: 900, fontSize: 18, lineHeight: 1.3 };

const subtitleStyle = {
  marginTop: 6,
  fontSize: 14,
  fontWeight: 700,
  color: "#777",
};

const linesWrapperStyle = {
  marginTop: 14,
  fontSize: 13,
  color: "#333",
  lineHeight: 1.7,
};

const lineItemStyle = { marginBottom: 4 };