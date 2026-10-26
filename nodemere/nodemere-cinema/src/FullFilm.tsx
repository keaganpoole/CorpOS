import React from "react";

import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { DirectedOpening, V4_SECONDS } from "./RevisionFour";

import { AuditionScene, AUDITION_SECONDS } from "./AuditionScene";

import { CalendarScene, CALENDAR_SECONDS } from "./CalendarScene";

import { NetworkScene, NETWORK_SECONDS } from "./NetworkScene";

import { HandoffScene, HANDOFF_SECONDS } from "./HandoffScene";

import { PeopleScene, PEOPLE_SECONDS } from "./PeopleScene";

import { ScenariosScene, SCENARIOS_SECONDS } from "./ScenariosScene";

import { NestScene, NEST_SECONDS } from "./NestScene";

import { EncryptionSceneEditor } from "./EncryptionSceneEditor";
import { FinalLogoScene } from "./FinalLogoScene";
import { ENCRYPTION_SECONDS, LOGO_SECONDS } from "./finaleTiming";
import { FutureHero } from "./HomepageHeadlines";
import { Stage, glide, p } from "./design";

const HANDOFF_START = V4_SECONDS + AUDITION_SECONDS + CALENDAR_SECONDS;
const PEOPLE_START = HANDOFF_START + HANDOFF_SECONDS;
const NETWORK_START = PEOPLE_START + PEOPLE_SECONDS;
const NEST_START = NETWORK_START + NETWORK_SECONDS;
const SCENARIOS_START = NEST_START + NEST_SECONDS;
export const FINALE_START = SCENARIOS_START + SCENARIOS_SECONDS;

export const FILM_SECONDS = FINALE_START + ENCRYPTION_SECONDS + LOGO_SECONDS;
const CLOSING_HERO_SECONDS = 2.8;
export const FULL_FILM_SECONDS = FILM_SECONDS + CLOSING_HERO_SECONDS;

const ClosingFutureHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  return (
    <Stage>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - p(time, 2.3, CLOSING_HERO_SECONDS, glide),
        }}
      >
        <FutureHero
          time={time * 1.84}
          gradientSweepDuration={2.8}
          continuousGradient
        />
      </div>
    </Stage>
  );
};

export const FullFilm: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        scale: 1.006
      }}
    >
      <Sequence
        name="01–02 — Incoming call and collection"
        durationInFrames={Math.round(V4_SECONDS * fps)}
      >
        <DirectedOpening />
      </Sequence>

      <Sequence
        name="03 — Audition"
        from={Math.round(V4_SECONDS * fps)}
        durationInFrames={Math.round(AUDITION_SECONDS * fps)}
        premountFor={fps}
      >
        <AuditionScene bridge />
      </Sequence>

      <Sequence
        name="04 — Calendar"
        from={Math.round((V4_SECONDS + AUDITION_SECONDS) * fps)}
        durationInFrames={Math.round(CALENDAR_SECONDS * fps)}
        premountFor={fps}
      >
        <CalendarScene bridge />
      </Sequence>

      <Sequence
        name="07 — Live Handoff"
        from={Math.round(HANDOFF_START * fps)}
        durationInFrames={Math.round(HANDOFF_SECONDS * fps)}
        premountFor={fps}
      >
        <HandoffScene bridge />
      </Sequence>

      <Sequence
        name="08 — People CRM"
        from={Math.round(PEOPLE_START * fps)}
        durationInFrames={Math.round(PEOPLE_SECONDS * fps)}
        premountFor={fps}
      >
        <PeopleScene bridge outgoingTitle={false} />
      </Sequence>

      <Sequence
        name="09 — Psych / Features / Grid"
        from={Math.round(NETWORK_START * fps)}
        durationInFrames={Math.round(NETWORK_SECONDS * fps)}
        premountFor={fps}
      >
        <NetworkScene />
      </Sequence>

      <Sequence
        name="10 — Nest & Intercom"
        from={Math.round(NEST_START * fps)}
        durationInFrames={Math.round(NEST_SECONDS * fps)}
        premountFor={fps}
      >
        <NestScene bridge />
      </Sequence>

      <Sequence
        name="10 — Scenarios Builder"
        from={Math.round(SCENARIOS_START * fps)}
        durationInFrames={Math.round(SCENARIOS_SECONDS * fps)}
        premountFor={fps}
      >
        <ScenariosScene bridge />
      </Sequence>
      <Sequence
        name="11 — AES-256-GCM Encryption"
        from={Math.round(FINALE_START * fps)}
        durationInFrames={Math.round(ENCRYPTION_SECONDS * fps)}
        premountFor={fps}
      >
        <EncryptionSceneEditor />
      </Sequence>
      <Sequence
        name="12 — Welcome to the future"
        from={Math.round((FINALE_START + ENCRYPTION_SECONDS) * fps)}
        durationInFrames={Math.round(CLOSING_HERO_SECONDS * fps)}
        premountFor={fps}
      >
        <ClosingFutureHero />
      </Sequence>
      <Sequence
        name="13 — Nodemere logo"
        from={Math.round(
          (FINALE_START + ENCRYPTION_SECONDS + CLOSING_HERO_SECONDS) * fps,
        )}
        durationInFrames={Math.round(LOGO_SECONDS * fps)}
        premountFor={fps}
      >
        <FinalLogoScene />
      </Sequence>
    </AbsoluteFill>
  );
};
