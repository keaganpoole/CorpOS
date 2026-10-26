import { AbsoluteFill, Composition, Folder, useVideoConfig } from "remotion";
import { IntercomScene } from "./IntercomScene";
import { CollectionScene } from "./CollectionScene";
import { DirectedOpening, V4_SECONDS } from "./RevisionFour";
import { FullFilm, FILM_SECONDS } from "./FullFilm";
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
import { ENCRYPTION_SECONDS, LOGO_TIMING } from "./finaleTiming";

const Opening = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <IntercomScene
        name="01 — Intercom cold open"
        from={0}
        durationInFrames={8.5 * fps}
        premountFor={fps}
        reply="Oh, not much. Just chillin' at the front desk."
      />
      <CollectionScene
        name="02 — The Receptionist Collection"
        from={8.5 * fps}
        durationInFrames={17 * fps}
        premountFor={fps}
      />
    </AbsoluteFill>
  );
};
export const Root = () => (
  <>
    <Composition
      id="Nodemere-Film"
      component={FullFilm}
      durationInFrames={Math.round(FILM_SECONDS * 60)}
      fps={60}
      width={3840}
      height={2160}
    />
    <Composition
      id="Nodemere-Opening"
      component={DirectedOpening}
      durationInFrames={Math.round(V4_SECONDS * 60)}
      fps={60}
      width={3840}
      height={2160}
    />
    <Folder name="Scenes">
      <Composition
        id="11-Encryption"
        component={EncryptionScene}
        durationInFrames={Math.round(ENCRYPTION_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="12-Final-Logo"
        component={FinalLogoScene}
        durationInFrames={LOGO_TIMING.end}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="08-People"
        component={PeopleScene}
        durationInFrames={Math.round(PEOPLE_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="09-Scenarios"
        component={ScenariosScene}
        durationInFrames={Math.round(SCENARIOS_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="10-Nest"
        component={NestScene}
        durationInFrames={Math.round(NEST_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="05-Drop-ins"
        component={DropInsScene}
        durationInFrames={Math.round(DROPINS_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="06-Network"
        component={NetworkScene}
        durationInFrames={Math.round(NETWORK_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="07-Handoff"
        component={HandoffScene}
        durationInFrames={Math.round(HANDOFF_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="03-Audition"
        component={AuditionScene}
        durationInFrames={Math.round(AUDITION_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="04-Calendar"
        component={CalendarScene}
        durationInFrames={Math.round(CALENDAR_SECONDS * 60)}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="Previous-Opening"
        component={Opening}
        durationInFrames={1530}
        fps={60}
        width={3840}
        height={2160}
      />
      <Composition
        id="01-Intercom"
        component={IntercomScene}
        durationInFrames={510}
        fps={60}
        width={3840}
        height={2160}
        defaultProps={{
          reply: "Oh, not much. Just chillin' at the front desk.",
        }}
      />
      <Composition
        id="02-Collection"
        component={CollectionScene}
        durationInFrames={1020}
        fps={60}
        width={3840}
        height={2160}
      />
    </Folder>
  </>
);
