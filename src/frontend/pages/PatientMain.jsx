import MakeAppointment from "./MakeAppointment";
import QueryAppointment from "./QueryAppointment";
import AppointmentList from "./AppointmentList";
import "../main.css"; // 你原本 Main 用的 main.css，確保路徑對（看 main.css 在哪裡）

export default function PatientMain() {
      return (
    <div className="main">
      <div className="flex-container" id="mainDisplay">
        {/* 左側 Sidebar：直接沿用你 Main 的 */}
        <div id="leftSideBar">
          <p style={{ fontWeight: "bold", fontSize: "24px", marginBottom: "20px" }}>
            MediCare
          </p>

          <div className="barIndexBlock">
            <div className="flex-container">
              <div className="indexIcon" />
              <p className="indexText">Patient</p>
            </div>
          </div>

          <div className="barIndexBlock">
            <div className="flex-container">
              <div className="indexIcon" />
              <p className="indexText">Appointments</p>
            </div>
          </div>
        </div>

        {/* 右側：中+右合併，並上下切 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            padding: 16,
            overflow: "hidden",
          }}
        >
          <section
            style={{
              flex: 1,
              background: "white",
              borderRadius: 12,
              border: "1px solid #ddd",
              padding: 16,
              overflow: "auto",
            }}
          >
            <MakeAppointment />
          </section>

          <section
            style={{
              flex: 1,
              background: "white",
              borderRadius: 12,
              border: "1px solid #ddd",
              padding: 16,
              overflow: "auto",
            }}
          >
            <QueryAppointment />
          </section>
          <section>
            <AppointmentList />
          </section>
        </div>
      </div>
    </div>
  );
}