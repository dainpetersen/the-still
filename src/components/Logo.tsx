export default function Logo() {
  return (
    <div className="flex flex-col leading-none select-none">
      <span
        className="tracking-[0.25em] uppercase"
        style={{ fontSize: "9px", color: "rgba(245,158,11,0.7)", letterSpacing: "0.25em" }}
      >
        THE
      </span>
      <div
        style={{
          height: "1px",
          background: "rgba(245,158,11,0.4)",
          margin: "2px 0",
          width: "100%",
        }}
      />
      <span
        className="font-bold tracking-widest uppercase"
        style={{ fontSize: "22px", color: "#f5f5f5", letterSpacing: "0.12em", lineHeight: 1 }}
      >
        STILL
      </span>
    </div>
  );
}
