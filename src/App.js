import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Main from "./frontend/main";
import PatientMain from "./frontend/pages/PatientMain";
import MakeAppointment from "./frontend/pages/MakeAppointment";
import AppointmentConfirmation from "./frontend/pages/AppointmentConfirmation";
import DoctorConfirmAppointments from "./frontend/pages/DoctorConfirmAppointments";
import { AppointmentProvider } from "./frontend/state/AppointmentContext";
import TeamInfo from "./frontend/pages/TeamInfo";
import DoctorConfirmModal from "./frontend/pages/DoctorConfirmModal";
import DoctorSchedulerPage from "./frontend/pages/DoctorSchedulerPage";


export default function App() {
  return (
    <AppointmentProvider>
      <BrowserRouter>
        <Routes>
          {/* 醫生端 */}
          <Route path="/" element={<Main />} />
          <Route path="team" element={<TeamInfo variant="doctor" />} />
          <Route path="appointments/new" element={<MakeAppointment />} />
          <Route path="/modal" element={<DoctorSchedulerPage />} />
          
       

          {/* 病人端 */}
          <Route path="/patient" element={<PatientMain />} />
          <Route path="/patient/confirm" element={<AppointmentConfirmation />} />
          <Route path="/patient/team" element={<TeamInfo variant="patient" />} />

          {/* 醫生確認預約 */}
          <Route path="/confirm" element={<DoctorConfirmAppointments />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppointmentProvider>
  );
}