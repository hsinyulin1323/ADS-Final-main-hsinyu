import React from "react";
import { useNavigate } from "react-router-dom";
import "../main.css";

import SidebarDoctor from "../components/Sidebar_Doctor";
import DoctorConfirmModal from "./DoctorConfirmModal";

export default function DoctorSchedulerPage() {
  const navigate = useNavigate();

  return (
    <div className="main">
      <div className="flex-container" id="mainDisplay">
        {/* Left sidebar */}
        <SidebarDoctor brand="GoooodEar" />

        {/* Right content: 這頁其實只負責把 Modal 打開 */}
        <div style={{ flex: 1 }}>
          <DoctorConfirmModal
            open={true}
            doctorName="Doctor J"
            doctorSubject="耳鼻喉科"
            onClose={() => navigate("/")}  // 關掉回 dashboard
          />
        </div>
      </div>
    </div>
  );
}