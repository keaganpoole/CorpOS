import React from "react";

import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { DirectedOpening, V4_SECONDS } from "./RevisionFour";

import { AuditionScene, AUDITION_SECONDS } from "./AuditionScene";

import { CalendarScene, CALENDAR_SECONDS } from "./CalendarScene";

import { DropInsScene, DROPINS_SECONDS } from "./DropInsScene";

import { NetworkScene, NETWORK_SECONDS } from "./NetworkScene";

import { HandoffScene, HANDOFF_SECONDS } from "./HandoffScene";

import { PeopleScene, PEOPLE_SECONDS } from "./PeopleScene";

import { ScenariosScene, SCENARIOS_SECONDS } from "./ScenariosScene";

import { NestScene, NEST_SECONDS } from "./NestScene";

import { EncryptionScene } from "./EncryptionScene";
import { FinalLogoScene } from "./FinalLogoScene";
import { ENCRYPTION_SECONDS, LOGO_SECONDS } from "./finaleTiming";

export const PHASE3_START = V4_SECONDS + AUDITION_SECONDS + CALENDAR_SECONDS;

export const PHASE4_START =
  PHASE3_START + DROPINS_SECONDS + NETWORK_SECONDS + HANDOFF_SECONDS;

export const FINALE_START =
  PHASE4_START + PEOPLE_SECONDS + SCENARIOS_SECONDS + NEST_SECONDS;

export const FILM_SECONDS = FINALE_START + ENCRYPTION_SECONDS + LOGO_SECONDS;

export const FullFilm: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
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
        name="05 — Drop-ins Builder"
        from={Math.round(PHASE3_START * fps)}
        durationInFrames={Math.round(DROPINS_SECONDS * fps)}
        premountFor={fps}
      >
        <DropInsScene bridge />
      </Sequence>

      <Sequence
        name="06 — Conversation Network"
        from={Math.round((PHASE3_START + DROPINS_SECONDS) * fps)}
        durationInFrames={Math.round(NETWORK_SECONDS * fps)}
        premountFor={fps}
      >
        <NetworkScene />
      </Sequence>

      <Sequence
        name="07 — Live Handoff"
        from={Math.round(
          (PHASE3_START + DROPINS_SECONDS + NETWORK_SECONDS) * fps,
        )}
        durationInFrames={Math.round(HANDOFF_SECONDS * fps)}
        premountFor={fps}
      >
        <HandoffScene bridge />
      </Sequence>

      <Sequence
        name="08 — People CRM"
        from={Math.round(PHASE4_START * fps)}
        durationInFrames={Math.round(PEOPLE_SECONDS * fps)}
        premountFor={fps}
      >
        <PeopleScene bridge />
      </Sequence>

      <Sequence
        name="09 — Scenarios"
        from={Math.round((PHASE4_START + PEOPLE_SECONDS) * fps)}
        durationInFrames={Math.round(SCENARIOS_SECONDS * fps)}
        premountFor={fps}
      >
        <ScenariosScene bridge />
      </Sequence>

      <Sequence
        name="10 — Nest & Intercom"
        from={Math.round(
          (PHASE4_START + PEOPLE_SECONDS + SCENARIOS_SECONDS) * fps,
        )}
        durationInFrames={Math.round(NEST_SECONDS * fps)}
        premountFor={fps}
      >
        <NestScene bridge />
      </Sequence>
      <Sequence
        name="11 — World-Class Encryption"
        from={Math.round(FINALE_START * fps)}
        durationInFrames={Math.round(ENCRYPTION_SECONDS * fps)}
        premountFor={fps}
      >
        <EncryptionScene bridge />
      </Sequence>
      <Sequence
        name="12 — Nodemere"
        from={Math.round((FINALE_START + ENCRYPTION_SECONDS) * fps)}
        durationInFrames={Math.round(LOGO_SECONDS * fps)}
        premountFor={fps}
      >
        <FinalLogoScene />
      </Sequence>
    </AbsoluteFill>
  );
};
