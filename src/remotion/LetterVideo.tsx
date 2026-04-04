import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// -- Warm cream/tan palette matching the PDF --
const COLORS = {
  bg: "#fdf8f0",
  bgDark: "#f5ede0",
  text: "#3d3d3d",
  accent: "#8a7f72",
  divider: "#d4c9b8",
  footer: "#b0a89e",
  gold: "#c4a265",
};

// -- Paw print SVG for decorative elements --
const PawPrint: React.FC<{
  x: number;
  y: number;
  size: number;
  opacity: number;
  rotation: number;
}> = ({ x, y, size, opacity, rotation }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: size,
      height: size,
      opacity,
      transform: `rotate(${rotation}deg)`,
    }}
  >
    <svg viewBox="0 0 100 100" fill={COLORS.divider}>
      <ellipse cx="50" cy="65" rx="22" ry="25" />
      <ellipse cx="28" cy="38" rx="11" ry="14" />
      <ellipse cx="72" cy="38" rx="11" ry="14" />
      <ellipse cx="15" cy="55" rx="10" ry="13" />
      <ellipse cx="85" cy="55" rx="10" ry="13" />
    </svg>
  </div>
);

// -- Floating particles for dreamy atmosphere --
const Particle: React.FC<{
  frame: number;
  x: number;
  delay: number;
  speed: number;
  size: number;
}> = ({ frame, x, delay, speed, size }) => {
  const adjustedFrame = Math.max(0, frame - delay);
  const y = 1920 - adjustedFrame * speed * 0.3;
  const drift = Math.sin(adjustedFrame * 0.02) * 30;
  const opacity = interpolate(adjustedFrame, [0, 30, 200, 260], [0, 0.4, 0.4, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x + drift,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${COLORS.gold}88, transparent)`,
        opacity,
      }}
    />
  );
};

// -- Shared timing calculation --
// narrationDurationS: scroll timing syncs to narration length
export function calculateTiming(letterText: string, fps: number, narrationDurationS?: number) {
  const paragraphs = letterText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const INTRO_DURATION = fps * 1.5;
  const PORTRAIT_REVEAL = fps * 1.5;
  const NAME_REVEAL = fps * 1;
  const MEMORIAL_REVEAL = fps * 1;
  const PAUSE_BEFORE_LETTER = fps * 0.5;
  const LETTER_START = INTRO_DURATION + PORTRAIT_REVEAL + NAME_REVEAL + MEMORIAL_REVEAL + PAUSE_BEFORE_LETTER;

  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const totalLetterFrames = narrationDurationS
    ? narrationDurationS * fps
    : paragraphs.length * fps * 6;

  const paragraphFrames = paragraphs.map((p) =>
    Math.round((p.length / totalChars) * totalLetterFrames)
  );

  const letterDuration = paragraphFrames.reduce((a, b) => a + b, 0);
  const OUTRO_DURATION = fps * 5;
  const OUTRO_START = LETTER_START + letterDuration;
  const TOTAL_FRAMES = Math.ceil(OUTRO_START + OUTRO_DURATION);

  return {
    paragraphs, paragraphFrames, INTRO_DURATION, PORTRAIT_REVEAL, NAME_REVEAL, MEMORIAL_REVEAL,
    LETTER_START, letterDuration, OUTRO_START, TOTAL_FRAMES,
  };
}

// -- Props passed from the render call --
export type LetterVideoProps = {
  petName: string;
  memorialText: string;
  letterText: string;
  narrationDurationS: number;
  narrationSrc?: string;
  bgMusicSrc?: string;
};

// -- Main Letter Video Component --
export const LetterVideo: React.FC<LetterVideoProps> = ({
  petName, memorialText, letterText, narrationDurationS, narrationSrc, bgMusicSrc,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const {
    paragraphs, paragraphFrames, INTRO_DURATION, PORTRAIT_REVEAL, NAME_REVEAL, MEMORIAL_REVEAL,
    LETTER_START, letterDuration, OUTRO_START,
  } = calculateTiming(letterText, fps, narrationDurationS);

  const bgColor = frame < OUTRO_START ? COLORS.bg : COLORS.bgDark;

  // -- Intro --
  const introOpacity = interpolate(frame, [0, fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  // -- Portrait animation --
  const portraitStart = INTRO_DURATION;
  const portraitOpacity = interpolate(
    frame, [portraitStart, portraitStart + fps], [0, 1],
    { extrapolateRight: "clamp" },
  );
  const portraitScale = interpolate(
    frame, [portraitStart, portraitStart + fps * 1.5], [1.05, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // -- Name --
  const nameStart = portraitStart + PORTRAIT_REVEAL;
  const nameOpacity = interpolate(frame, [nameStart, nameStart + fps], [0, 1], {
    extrapolateRight: "clamp",
  });
  const nameY = interpolate(frame, [nameStart, nameStart + fps * 1.5], [20, 0], {
    extrapolateRight: "clamp",
  });

  // -- Memorial text --
  const memStart = nameStart + NAME_REVEAL;
  const memOpacity = interpolate(frame, [memStart, memStart + fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  // -- Divider --
  const divStart = memStart + MEMORIAL_REVEAL;
  const divWidth = interpolate(frame, [divStart, divStart + fps], [0, 600], {
    extrapolateRight: "clamp",
  });

  // -- Letter scroll synced to narration --
  // Estimate total text height from content
  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const charsPerLine = 42;
  const lineHeightPx = 61; // 36px * 1.7
  const totalLines = Math.ceil(totalChars / charsPerLine);
  const totalTextHeight = totalLines * lineHeightPx + paragraphs.length * 48;
  const visibleHeight = 750;
  const scrollDistance = Math.max(0, totalTextHeight - visibleHeight);

  const letterFrame = Math.max(0, frame - LETTER_START);
  const scrollY = interpolate(
    letterFrame, [0, letterDuration], [0, -scrollDistance],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // -- Outro --
  const outroOpacity = interpolate(
    frame,
    [OUTRO_START, OUTRO_START + fps * 1.5, durationInFrames - fps * 1.5, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // -- Particles --
  const particles = Array.from({ length: 15 }, (_, i) => ({
    x: 80 + (i * 137) % 920,
    delay: i * 40,
    speed: 0.5 + (i % 3) * 0.3,
    size: 4 + (i % 4) * 3,
  }));

  // -- Background music volume --
  const bgMusicVolume = interpolate(
    frame, [0, fps * 2, durationInFrames - fps * 3, durationInFrames], [0, 0.12, 0.12, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  // -- Narration volume --
  const narrationDelay = Math.round(fps * 3);
  const narrationVolume = interpolate(
    frame,
    [narrationDelay, narrationDelay + fps, durationInFrames - fps * 2, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Background music */}
      {bgMusicSrc && (
        <Audio src={staticFile(bgMusicSrc)} volume={bgMusicVolume} />
      )}

      {/* Narration */}
      {narrationSrc && (
        <Sequence from={narrationDelay}>
          <Audio src={staticFile(narrationSrc)} volume={narrationVolume} />
        </Sequence>
      )}

      {/* Vignette */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.08) 100%)",
          zIndex: 10, pointerEvents: "none",
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <Particle key={i} frame={frame} {...p} />
      ))}

      {/* Decorative paw prints */}
      <PawPrint x={60} y={200} size={40} opacity={0.08} rotation={-15} />
      <PawPrint x={920} y={400} size={35} opacity={0.06} rotation={20} />
      <PawPrint x={100} y={1600} size={45} opacity={0.07} rotation={-30} />
      <PawPrint x={880} y={1400} size={30} opacity={0.05} rotation={10} />

      {/* Main content */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "80px 80px", opacity: introOpacity,
        }}
      >
        {/* Portrait */}
        <div
          style={{
            width: 320, height: 320, borderRadius: "50%", overflow: "hidden",
            border: `4px solid ${COLORS.divider}`,
            boxShadow: "0 8px 40px rgba(0,0,0,0.1)",
            opacity: portraitOpacity, transform: `scale(${portraitScale})`,
            marginTop: 80, flexShrink: 0,
          }}
        >
          <Img
            src={staticFile("portrait.png")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Pet Name */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 72, fontWeight: "bold", color: COLORS.text,
            opacity: nameOpacity, transform: `translateY(${nameY}px)`,
            marginTop: 40, flexShrink: 0,
          }}
        >
          {petName}
        </div>

        {/* Memorial Text */}
        <div
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 28, fontStyle: "italic", color: COLORS.accent,
            opacity: memOpacity, marginTop: 12, flexShrink: 0,
          }}
        >
          {memorialText}
        </div>

        {/* Divider */}
        <div
          style={{
            width: divWidth, height: 2, backgroundColor: COLORS.divider,
            marginTop: 40, flexShrink: 0,
          }}
        />

        {/* Letter Body */}
        <div
          style={{
            flex: 1, overflow: "hidden", width: "100%",
            marginTop: 40, position: "relative",
          }}
        >
          {letterFrame > 0 && (
            <div
              style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 40,
                background: `linear-gradient(to bottom, ${COLORS.bg}, transparent)`,
                zIndex: 2, pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 100,
              background: `linear-gradient(to top, ${COLORS.bg}, transparent)`,
              zIndex: 2, pointerEvents: "none",
            }}
          />

          <div style={{ transform: `translateY(${scrollY}px)`, paddingTop: 40 }}>
            {paragraphs.map((para, i) => {
              const letterVisible = frame >= LETTER_START ? 1 : 0;
              return (
                <p
                  key={i}
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: 36, lineHeight: 1.7, color: COLORS.text,
                    opacity: letterVisible, marginBottom: 48, textAlign: "left",
                  }}
                >
                  {para}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      {/* Outro */}
      {frame >= OUTRO_START && (
        <div
          style={{
            position: "absolute", bottom: 120, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            opacity: outroOpacity,
          }}
        >
          <div style={{ width: 60, height: 2, backgroundColor: COLORS.divider, marginBottom: 30 }} />
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 24, color: COLORS.footer, letterSpacing: 2,
            }}
          >
            Created with love by Sahm
          </div>
          <div
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 20, color: COLORS.footer, marginTop: 8, opacity: 0.7,
            }}
          >
            getsahm.com
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
