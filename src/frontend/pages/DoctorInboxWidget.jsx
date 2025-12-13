export default function DoctorInboxWidget({ pendingCount, scheduledCount, onClickPending }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 12,
        background: "rgba(255,255,255,0.9)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* 上：Pending */}
        <div
          onClick={onClickPending}
          style={{
            cursor: "pointer",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #f3c6c6",
            background: "#FFEBEE",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Not confirmed yet</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#b71c1c" }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#b71c1c" }}>
            Click to confirm
          </div>
        </div>

        {/* 下：Scheduled */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #cfe7d2",
            background: "#E8F5E9",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Scheduled</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#2E7D32" }}>
            {scheduledCount}
          </div>
        </div>
      </div>
    </div>
  );
}