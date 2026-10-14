import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Stage, move, settle } from "../motion";
import { galleryCells, galleryRosterOrder } from "../product/catalogGeometry";
import catalog from "../product/catalog.json";
import { kayla } from "../product/NestPresentation";
import { ReceptionistDetail } from "../product/ReceptionistDetail";
import { CollectionIcon } from "../CollectionIcon";
import { MousePointer2 } from "lucide-react";

const roster = galleryRosterOrder(catalog.rows);
const cells = galleryCells(
  { x: 1100, y: 700, scale: 1 },
  2400,
  1600,
  catalog.rows.length,
);
const focus = cells
  .filter((c) => catalog.rows[roster[c.personIndex]].id === 4)
  .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
const fx = focus.x + focus.width / 2,
  fy = focus.y + focus.height / 2;

export function ReceptionistCollection() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const reveal = move(t, 0, 0.9, 0, 1, settle);
  const pull = move(t, 0.15, 2.7, 0, 1);
  const selection = move(t, 6.8, 9.2, 0, 1);
  const zoom = 3.15 + (1.04 - 3.15) * pull + selection * 0.8;
  const x = move(t, 3.3, 6.8, 0, -200) + selection * 200;
  const y = move(t, 3.3, 6.8, 0, -70) + selection * 70;
  const titleIn = move(t, 2.05, 2.85, 0, 1, settle);
  const titleOut = move(t, 5.2, 5.8, 0, 1);
  const detail = move(t, 9.25, 10.25, 0, 1, settle);
  return (
    <Stage transparent>
      <AbsoluteFill
        style={{
          clipPath: `inset(${(1 - reveal) * 46}% 0)`,
          background: "#020202",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            perspective: 1800,
            opacity: 1 - detail * 0.82,
            filter: `blur(${detail * 8}px)`,
          }}
        >
          <div
            className="ns-gallery-world"
            style={{
              width: 0,
              height: 0,
              left: 960 + x,
              top: 540 + y,
              scale: zoom,
              transform: `rotateX(${move(t, 0, 2.7, 9, 0)}deg) rotateY(${move(t, 0, 2.7, -13, 0) + move(t, 3.4, 6.7, 0, 3) - selection * 3}deg)`,
            }}
          >
            {cells.map((cell) => {
              const p = catalog.rows[roster[cell.personIndex]];
              const distance = Math.hypot(cell.x - fx, cell.y - fy);
              return (
                <div
                  key={cell.key}
                  className="ns-gallery-tile"
                  style={{
                    left: cell.x - fx,
                    top: cell.y - fy,
                    width: cell.width,
                    height: cell.height,
                    opacity: 1 - selection * Math.min(0.74, distance / 1200),
                    zIndex: cell.key === focus.key ? 2 : 1,
                  }}
                >
                  <Img
                    src={staticFile(p.avatar)}
                    style={{
                      transform:
                        cell.key === focus.key
                          ? `scale(${move(t, 8.45, 9.15, 1, 1.08, settle)})`
                          : undefined,
                      filter: `grayscale(${1 - move(t, 0.2 + Math.min(0.6, distance / 1600), 1.08 + Math.min(0.6, distance / 1600), 0, 1, settle)})`,
                    }}
                  />
                  <span className="ns-gallery-neon" />
                </div>
              );
            })}
          </div>
        </div>
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `linear-gradient(0deg,rgba(2,2,2,${0.9 * (1 - titleOut)}) 0%,transparent 58%),linear-gradient(90deg,#02020260,transparent 25%,transparent 75%,#02020260)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: move(t, 8.2, 9.05, 1240, 1060, settle),
            top: move(t, 8.2, 9.05, 750, 575, settle),
            opacity: move(t, 8.2, 8.5, 0, 1) * (1 - move(t, 9.25, 9.45, 0, 1)),
            scale: move(t, 9.08, 9.2, 1, 0.88),
          }}
        >
          <MousePointer2
            size={36}
            fill="#f5f5f7"
            stroke="#111"
            strokeWidth={1.4}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 130,
            right: 130,
            bottom: 108,
            opacity: titleIn * (1 - titleOut),
            translate: `0 ${70 * (1 - titleIn)}px`,
            fontFamily: "Inter",
            fontSize: 124,
            fontWeight: 600,
            letterSpacing: "-.065em",
            lineHeight: 1.02,
            color: "var(--color-white)",
          }}
        >
          Choose your
          <CollectionIcon time={Math.max(0, t - 2.05)} />
          <br />
          <span style={{ color: "var(--color-white)" }}>receptionist.</span>
        </div>
        <Sequence
          from={9.25 * fps}
          durationInFrames={7.05 * fps}
          premountFor={fps}
          name="Kayla — original detail card"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: detail,
              perspective: 1800,
            }}
          >
            <div
              className="film-detail"
              style={{
                width: 760,
                scale:
                  move(t, 9.25, 10.65, 0.78, 0.94, settle) +
                  move(t, 12.7, 15.3, 0, 0.95),
                translate: `0 ${move(t, 9.25, 10.25, 95, 0, settle) + move(t, 12.7, 15.3, 0, -410)}px`,
                transform: `rotateY(${move(t, 9.25, 10.65, -7, 0, settle)}deg)`,
              }}
            >
              <ReceptionistDetail person={kayla} />
            </div>
          </div>
        </Sequence>
      </AbsoluteFill>
    </Stage>
  );
}
