import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Main from "./frontend/main";
import PatientMain from "./frontend/pages/PatientMain";
import MakeAppointment from "./frontend/pages/MakeAppointment";
import AppointmentConfirmation from "./frontend/pages/AppointmentConfirmation";
import DoctorConfirmAppointments from "./frontend/pages/DoctorConfirmAppointments";
import { AppointmentProvider } from "./frontend/state/AppointmentContext";


export default function App() {
  return (
    <AppointmentProvider>
      <BrowserRouter>
        <Routes>
          {/* 醫生端 */}
          <Route path="/" element={<Main />} />
          <Route
            path="appointments/new"
            element={<MakeAppointment />}
          />

          {/* 病人端 */}
          <Route path="/patient" element={<PatientMain />} />
          <Route path="/patient/confirm" element={<AppointmentConfirmation />} />

          {/* 醫生確認預約 */}
          <Route path="/confirm" element={<DoctorConfirmAppointments />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppointmentProvider>
  );
}