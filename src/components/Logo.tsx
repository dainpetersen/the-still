export default function Logo() {
  return (
    <div className="flex flex-col leading-none select-none">
      <span
        className="tracking-[0.25em] uppercase"
        style={{ fontSize: "9px", color: "rgb(var(--brown-rgb) / 0.65)", letterSpacing: "0.25em", fontFamily: "Georgia,serif" }}
      >
        COMMON
      </span>
      <div
        style={{
          height: "1px",
          background: "rgb(var(--brown-rgb) / 0.35)",
          margin: "2px 0",
          width: "100%",
        }}
      />
      <span
        className="font-bold tracking-widest uppercase"
        style={{ fontSize: "22px", color: "var(--accent)", letterSpacing: "0.12em", lineHeight: 1, fontFamily: "Georgia,serif" }}
      >
        CASK
      </span>
    </div>
  );
}
