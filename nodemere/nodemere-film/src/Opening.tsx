import { Sequence, useVideoConfig } from "remotion";
import { NestColdOpen } from "./scenes/NestColdOpen";
import { ReceptionistCollection } from "./scenes/ReceptionistCollection";

export function Opening() {
  const { fps } = useVideoConfig();
  return (
    <>
      <Sequence
        durationInFrames={9.5 * fps}
        premountFor={fps}
        name="01 · Nest cold open"
      >
        <NestColdOpen />
      </Sequence>
      <Sequence
        from={8.7 * fps}
        durationInFrames={16.3 * fps}
        premountFor={fps}
        name="02 · Receptionist Collection"
      >
        <ReceptionistCollection />
      </Sequence>
    </>
  );
}
