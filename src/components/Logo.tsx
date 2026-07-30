export function Logo({ size = 44 }: { size?: number }) {
  const badge = Math.round(size * 0.2);
  return (
    <div
      className="relative grid place-items-center rounded-[14px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(140deg,#13c1ab,#0b7466)",
        boxShadow: "0 6px 16px rgba(12,125,112,.4)",
      }}
    >
      <span
        className="font-extrabold text-white"
        style={{ fontSize: size * 0.32, letterSpacing: "-.3px" }}
      >
        GSM
      </span>
      <span
        className="absolute font-extrabold"
        style={{
          bottom: -6,
          right: -6,
          background: "#f5a623",
          color: "#3a2600",
          fontSize: Math.max(8, badge),
          padding: "2px 5px",
          borderRadius: 7,
          border: "2px solid #fff",
        }}
      >
        1С
      </span>
    </div>
  );
}
