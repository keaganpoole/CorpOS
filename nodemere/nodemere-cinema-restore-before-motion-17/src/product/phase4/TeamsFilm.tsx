import { Img, OffthreadVideo, staticFile } from "remotion";
import {
  IdCardLanyard,
  CalendarFold,
  BookUser,
  Webhook,
  Activity,
  Phone,
  Plus,
  ChevronDown,
  MoreHorizontal,
  CakeSlice,
  ArrowDownLeft,
  ArrowUpRight,
  PhoneMissed,
  PhoneOff,
} from "lucide-react";
const agents = [
  { name: "Maggie", id: 3, role: "Inbound", age: 26, active: true },
  { name: "Kayla", id: 4, role: "All calls", age: 28, active: true },
  { name: "Piper", id: 10, role: "Off", age: 25, active: false },
];
export function TeamsFilm() {
  return (
    <div
      style={{
        position: "relative",
        width: 1600,
        height: 900,
        background: "#020202",
        border: "1px solid #ffffff12",
        borderRadius: 12,
        overflow: "hidden",
        color: "white",
        fontFamily: "Inter",
        fontSize: 12,
      }}
    >
      <header
        style={{
          height: 56,
          borderBottom: "1px solid #ffffff0d",
          display: "flex",
          alignItems: "center",
          padding: "0 38px",
          gap: 12,
        }}
      >
        <Img
          src={staticFile("phase4/nodemere-logo.png")}
          style={{ width: 28, height: 28, objectFit: "contain" }}
        />
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.6 }}>
          nodemere
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 10,
            alignItems: "center",
            color: "#a1a1aa",
          }}
        >
          Luxe Hair Studio
          <ChevronDown size={12} />
          <span
            style={{
              width: 27,
              height: 27,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "#171719",
              fontSize: 10,
            }}
          >
            LW
          </span>
        </div>
      </header>
      <aside
        style={{
          position: "absolute",
          top: 56,
          left: 0,
          bottom: 0,
          width: 76,
          borderRight: "1px solid #ffffff0d",
          paddingTop: 23,
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          gap: 23,
        }}
      >
        {[IdCardLanyard, CalendarFold, BookUser, Webhook, Activity, Phone].map(
          (Icon, i) => (
            <div
              key={i}
              style={{
                width: 40,
                height: 36,
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                background: i === 0 ? "#ffffff09" : "transparent",
                color: i === 0 ? "#fff" : "#71717a",
              }}
            >
              <Icon size={18} />
            </div>
          ),
        )}
      </aside>
      <main
        style={{ position: "absolute", top: 56, left: 76, right: 0, bottom: 0 }}
      >
        <div style={{ padding: "28px 40px 0" }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: -0.7,
              margin: 0,
            }}
          >
            Team
          </h1>
          <p style={{ fontSize: 12, color: "#71717a", marginTop: 6 }}>
            Manage receptionists and staff
          </p>
        </div>
        <div
          style={{
            padding: "22px 40px 12px",
            display: "flex",
            alignItems: "center",
            gap: 25,
          }}
        >
          <span style={{ fontWeight: 500 }}>Receptionists</span>
          <span style={{ color: "#71717a" }}>Staff</span>
          <button
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 15px",
              borderRadius: 8,
              background: "#fafafa",
              color: "#09090b",
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            New Receptionist
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,340px)",
            gap: 24,
            padding: "20px 48px",
          }}
        >
          {agents.map((a) => (
            <article
              key={a.id}
              style={{
                width: 340,
                borderRadius: 28,
                overflow: "hidden",
                background: "#0a0a0a",
                border: "1px solid #ffffff0f",
              }}
            >
              <div style={{ height: 280, position: "relative" }}>
                {a.active ? (
                  <OffthreadVideo
                    src={staticFile(`videos/${a.id}-source.mp4`)}
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Img
                    src={staticFile(`catalog/${a.id}.png`)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to top,#0a0a0a, #0a0a0a40 40%,transparent 75%)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 16,
                    top: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#0009",
                    border: "1px solid #ffffff0f",
                    borderRadius: 20,
                    padding: "5px 8px",
                    fontSize: 8,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: a.active ? "#34d399" : "#71717a",
                    }}
                  />
                  {a.active ? "Active" : "Inactive"}
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: 20,
                    bottom: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <strong style={{ fontSize: 24, letterSpacing: -0.8 }}>
                    {a.name}
                  </strong>
                  <span
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                      fontSize: 10,
                      color: "#a1a1aa",
                    }}
                  >
                    <CakeSlice size={10} />
                    {a.age}
                  </span>
                </div>
              </div>
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 8,
                        textTransform: "uppercase",
                        letterSpacing: 1.3,
                        color: "#71717a",
                        marginBottom: 6,
                      }}
                    >
                      Role
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>
                      {a.role}
                    </div>
                  </div>
                  <MoreHorizontal size={16} color="#71717a" />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "18px 24px",
                    paddingTop: 26,
                  }}
                >
                  {[ArrowDownLeft, ArrowUpRight, PhoneOff, PhoneMissed].map(
                    (Icon, i) => (
                      <div key={i}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            color: "#71717a",
                            fontSize: 8,
                            textTransform: "uppercase",
                            letterSpacing: 0.8,
                          }}
                        >
                          <Icon size={10} />
                          {["Inbound", "Outbound", "Failed", "Missed"][i]}
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 800,
                            marginTop: 5,
                          }}
                        >
                          {a.active
                            ? [
                                a.id === 3 ? 128 : 86,
                                a.id === 3 ? 0 : 42,
                                0,
                                2,
                              ][i]
                            : 0}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
