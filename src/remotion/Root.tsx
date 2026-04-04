import { Composition } from "remotion";
import { LetterVideo, calculateTiming } from "./LetterVideo";
import type { LetterVideoProps } from "./LetterVideo";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LetterFromHeaven"
      component={LetterVideo}
      fps={FPS}
      width={1080}
      height={1920}
      // Duration computed dynamically from input props
      durationInFrames={FPS * 60} // default fallback
      defaultProps={{
        petName: "Pet",
        memorialText: "",
        letterText: "",
        narrationDurationS: 60,
      }}
      calculateMetadata={({ props }) => {
        const { TOTAL_FRAMES } = calculateTiming(
          props.letterText,
          FPS,
          props.narrationDurationS,
        );
        return { durationInFrames: TOTAL_FRAMES, props };
      }}
    />
  );
};
