// Product motion props are retained verbatim. Only their clock is replaced.
import React, { createContext, forwardRef, useContext } from "react";
import { Easing, interpolate } from "remotion";

const Clock = createContext(0);
export const MotionClock = ({ time, children }) => (
  <Clock.Provider value={Math.max(0, time)}>{children}</Clock.Provider>
);
export const useMotionTime = () => useContext(Clock);
export const useReducedMotion = () => false;
export const AnimatePresence = ({ children }) => <>{children}</>;

function element(tag) {
  return forwardRef(function FrameElement(
    {
      initial,
      animate,
      exit,
      variants,
      transition,
      style,
      children,
      layout,
      layoutId,
      ...props
    },
    ref,
  ) {
    const time = useMotionTime();
    const to =
      typeof animate === "string" ? variants?.[animate] || {} : animate || {};
    const from =
      initial === false
        ? to
        : typeof initial === "string"
          ? variants?.[initial] || {}
          : initial || to;
    const timing = to.transition || transition || {};
    const duration = timing.duration || 0.2;
    const curve = Array.isArray(timing.ease)
      ? Easing.bezier(...timing.ease)
      : Easing.bezier(0.22, 1, 0.36, 1);
    const progress = interpolate(
      time,
      [timing.delay || 0, (timing.delay || 0) + duration],
      [0, 1],
      { easing: curve, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const value = (key, fallback) => {
      const start = from[key] ?? to[key] ?? fallback;
      const end = to[key] ?? start;
      const specific = timing[key];
      const amount = specific
        ? interpolate(
            time,
            [
              specific.delay || 0,
              (specific.delay || 0) + (specific.duration || 0.2),
            ],
            [0, 1],
            {
              easing: Array.isArray(specific.ease)
                ? Easing.bezier(...specific.ease)
                : curve,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          )
        : progress;
      return typeof start === "number" && typeof end === "number"
        ? start + (end - start) * amount
        : end;
    };
    const computed = { ...style };
    if ("opacity" in to) computed.opacity = value("opacity", 1);
    if ("x" in to || "y" in to || "scale" in to || "scaleX" in to)
      computed.transform = `translate(${value("x", 0)}px,${value("y", 0)}px) scale(${value("scale", 1)}) scaleX(${value("scaleX", 1)})`;
    if ("filter" in to) {
      const a = parseFloat(String(from.filter || "").replace("blur(", ""));
      const b = parseFloat(String(to.filter || "").replace("blur(", ""));
      computed.filter =
        Number.isFinite(a) && Number.isFinite(b)
          ? `blur(${a + (b - a) * progress}px)`
          : to.filter;
    }
    return React.createElement(
      tag,
      { ...props, ref, style: computed },
      children,
    );
  });
}
/** @type {Record<string, React.ComponentType<any>>} */
export const motion = {
  div: element("div"),
  span: element("span"),
  img: element("img"),
  button: element("button"),
};
