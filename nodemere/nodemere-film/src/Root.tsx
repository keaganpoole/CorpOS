import { Composition, Folder, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Opening } from "./Opening";
import { NestColdOpen } from "./scenes/NestColdOpen";
import { ReceptionistCollection } from "./scenes/ReceptionistCollection";
import "./product/brand.css";
import "./product/studio.css";
import "./product/gallery.css";
import "./product/nest.css";
import "./film.css";

for (const weight of ["400", "600", "700", "900"])
  loadFont({
    family: "Inter",
    url: staticFile(`fonts/Inter-${weight}.ttf`),
    weight,
  });
export const RemotionRoot = () => (
  <>
    <Composition
      id="Nodemere-Opening"
      component={Opening}
      width={3840}
      height={2160}
      fps={60}
      durationInFrames={1500}
    />
    <Folder name="Scenes">
      <Composition
        id="01-Nest-Cold-Open"
        component={NestColdOpen}
        width={3840}
        height={2160}
        fps={60}
        durationInFrames={570}
      />
      <Composition
        id="02-Receptionist-Collection"
        component={ReceptionistCollection}
        width={3840}
        height={2160}
        fps={60}
        durationInFrames={978}
      />
    </Folder>
  </>
);
