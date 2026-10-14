// Embedded detail card extracted verbatim from HireReceptionistModal.jsx.
// Only media playback and application handlers are adapted for the silent film.
import React from "react";
import { Img, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { User, Pause, Play, Volume2, Loader2 } from "lucide-react";
import IntercomVoiceLine from "./VoiceLine";
const isCreatedReceptionist = () => false;
const catalogAccentTraits = () => [];
const catalogCoreTraits = (person) => person.traits || [];
const catalogMbti = (person) =>
  person.personality?.mbti || person.personality_type || "";
export function ReceptionistDetail({ person }) {
  const { fps } = useVideoConfig();
  const description = person.description;
  const expandableDescription = false;
  const descriptionExpanded = true;
  const hideVoiceButton = true;
  const compactVoicePreview = false;
  const playingVoice = null;
  const voiceLevel = 0;
  const hiringId = null;
  const archiving = false;
  const playVoice = () => {};
  const setDescriptionExpanded = () => {};
  const setPersonalityPerson = () => {};
  const handleSelect = () => {};
  const setHireError = () => {};
  const setArchiveTarget = () => {};
  return (
    <section
      className={`ns-receptionist-preview-card ns-catalog-review ${person.avatar_video ? "ns-catalog-video-review" : ""}`}
      key={person.id || person.full_name}
    >
      <div className="ns-receptionist-preview-image">
        {person.avatar_video ? (
          <Video
            src={staticFile(person.avatar_video)}
            muted
            loop
            premountFor={fps}
            objectFit="contain"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              background: "#09090a",
            }}
            aria-label={`${person.full_name || "Receptionist"} video portrait`}
          />
        ) : person.avatar ? (
          <Img
            src={staticFile(person.avatar)}
            alt={person.full_name || "Receptionist"}
            style={
              person.source === "created_receptionist" ||
              person.created_receptionist_id != null
                ? { objectPosition: "center top" }
                : undefined
            }
          />
        ) : (
          <div className="ns-gallery-placeholder">
            <User size={64} />
          </div>
        )}
        <div className="ns-receptionist-preview-image-wash" />
      </div>
      <div className="ns-receptionist-preview-body">
        <div
          className={`ns-catalog-status-row${hideVoiceButton ? " is-autoplay" : ""}${compactVoicePreview ? " is-compact-preview" : ""}`}
        >
          {compactVoicePreview && person.voice ? (
            <button
              type="button"
              className="ns-catalog-preview-button"
              onClick={(event) => {
                playVoice(person.voice, person.id, { nativePlayback: true });
                if (event.detail > 0) event.currentTarget.blur();
              }}
            >
              <span>{playingVoice === person.id ? "Playing" : "Preview"}</span>
              {playingVoice === person.id ? (
                <Pause size={13} />
              ) : (
                <Volume2 size={13} />
              )}
            </button>
          ) : (
            <span className="ns-eyebrow">
              {person.source === "created_receptionist"
                ? "YOUR CREATION"
                : "AVAILABLE"}
            </span>
          )}
          {hideVoiceButton && person.voice && (
            <IntercomVoiceLine
              enabled={playingVoice === person.id}
              level={voiceLevel}
            />
          )}
        </div>
        <h2>{person.full_name || "Receptionist"}</h2>
        {description &&
          (expandableDescription ? (
            <div className="ns-catalog-description">
              <p
                className={`ns-receptionist-preview-copy${descriptionExpanded ? "" : " is-collapsed"}`}
              >
                {description}
              </p>
              <button
                type="button"
                aria-expanded={descriptionExpanded}
                onClick={() => setDescriptionExpanded((expanded) => !expanded)}
              >
                {descriptionExpanded ? "Show less" : "Show more"}
              </button>
            </div>
          ) : (
            <p className="ns-receptionist-preview-copy">{description}</p>
          ))}
        <dl
          className={`ns-catalog-review-meta${isCreatedReceptionist(person) ? " ns-catalog-review-meta-created" : ""}`}
        >
          {person.age && (
            <div>
              <dt>Age</dt>
              <dd>
                {String(person.age).match(/^\d+$/)
                  ? `${person.age} years old`
                  : person.age}
              </dd>
            </div>
          )}
          {catalogMbti(person) && (
            <div>
              <dt>Personality</dt>
              <dd>
                <button
                  type="button"
                  onClick={() => setPersonalityPerson(person)}
                >
                  {catalogMbti(person)}
                </button>
              </dd>
            </div>
          )}
          {catalogAccentTraits(person).length > 0 && (
            <div>
              <dt>Accent</dt>
              <dd>{catalogAccentTraits(person).join(" · ")}</dd>
            </div>
          )}
        </dl>
        {catalogCoreTraits(person).length > 0 && (
          <div className="ns-catalog-review-traits">
            <span>Core traits</span>
            <div>
              {catalogCoreTraits(person).map((trait, i) => (
                <span key={i}>{trait}</span>
              ))}
            </div>
          </div>
        )}
        <div className="ns-receptionist-preview-actions">
          {person.voice && !hideVoiceButton ? (
            <div className="ns-catalog-voice-preview">
              <button
                type="button"
                className="ns-take-play"
                aria-label={
                  playingVoice === person.id
                    ? "Pause voice preview"
                    : "Play voice preview"
                }
                onClick={() => playVoice(person.voice, person.id)}
              >
                {playingVoice === person.id ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
              <IntercomVoiceLine
                enabled={playingVoice === person.id}
                level={voiceLevel}
              />
              <span>
                {playingVoice === person.id
                  ? "Playing preview"
                  : "Preview voice"}
              </span>
            </div>
          ) : !person.voice ? (
            <span className="ns-footnote">No voice preview</span>
          ) : null}
          <div
            className={`ns-catalog-hire-actions${isCreatedReceptionist(person) ? " is-created" : ""}`}
          >
            <button
              type="button"
              className="ns-primary"
              disabled={Boolean(hiringId) || archiving}
              onClick={() => handleSelect(person)}
            >
              {hiringId ===
              (person.created_receptionist_id ??
                person.custom_voice_id ??
                person.catalog_id ??
                person.id) ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Hiring…
                </>
              ) : (
                <>
                  Hire {person.first_name || person.full_name || "receptionist"}
                </>
              )}
            </button>
            {person.created_receptionist_id != null && (
              <button
                type="button"
                className="ns-catalog-archive-action"
                disabled={Boolean(hiringId) || archiving}
                onClick={() => {
                  setHireError("");
                  setArchiveTarget(person);
                }}
              >
                {archiving ? "Archiving…" : "Archive"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
