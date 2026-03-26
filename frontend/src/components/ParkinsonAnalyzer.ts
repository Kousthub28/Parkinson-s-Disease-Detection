import type { LandmarkPoint, PoseFrame, SymptomAnalysis } from './therapyTypes';

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

type WristSample = {
  time: number;
  x: number;
  y: number;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getLandmark = (landmarks: LandmarkPoint[], index: number) => landmarks[index];

const mean = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const distance = (a: LandmarkPoint, b: LandmarkPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export class ParkinsonAnalyzer {
  private wristHistory: WristSample[] = [];
  private postureAngles: number[] = [];
  private amplitudeRatios: number[] = [];
  private speedValues: number[] = [];
  private lastFrame: PoseFrame | null = null;

  update(frame: PoseFrame | null): SymptomAnalysis {
    if (!frame) {
      return {
        tremorScore: 0,
        bradykinesiaScore: 0,
        postureScore: 0,
        amplitudeScore: 0,
        overallRisk: 'LOW',
        issues: {
          tremor: false,
          speed: 'SLOW',
          stability: 'POOR',
          amplitude: 'REDUCED',
          noPerson: true,
          postureTiltDegrees: 0,
        },
      };
    }

    const leftWrist = getLandmark(frame.landmarks, LEFT_WRIST);
    const rightWrist = getLandmark(frame.landmarks, RIGHT_WRIST);
    const leftShoulder = getLandmark(frame.landmarks, LEFT_SHOULDER);
    const rightShoulder = getLandmark(frame.landmarks, RIGHT_SHOULDER);
    const leftHip = getLandmark(frame.landmarks, LEFT_HIP);
    const rightHip = getLandmark(frame.landmarks, RIGHT_HIP);
    const leftElbow = getLandmark(frame.landmarks, LEFT_ELBOW);
    const rightElbow = getLandmark(frame.landmarks, RIGHT_ELBOW);

    const keyPoints = [leftWrist, rightWrist, leftShoulder, rightShoulder, leftHip, rightHip, leftElbow, rightElbow];
    // Lowered visibility threshold to match ExerciseEngine
    if (keyPoints.some((point) => !point || point.visibility < 0.3)) {
      return {
        tremorScore: 0,
        bradykinesiaScore: 0,
        postureScore: 0,
        amplitudeScore: 0,
        overallRisk: 'LOW',
        issues: {
          tremor: false,
          speed: 'SLOW',
          stability: 'POOR',
          amplitude: 'REDUCED',
          noPerson: true,
          postureTiltDegrees: 0,
        },
      };
    }

    const wristCenter = {
      x: (leftWrist.x + rightWrist.x) / 2,
      y: (leftWrist.y + rightWrist.y) / 2,
    };
    this.wristHistory.push({ time: frame.timestamp, ...wristCenter });
    this.wristHistory = this.wristHistory.filter((sample) => frame.timestamp - sample.time < 4000);

    if (this.lastFrame) {
      const dt = Math.max((frame.timestamp - this.lastFrame.timestamp) / 1000, 0.001);
      const prevLeft = getLandmark(this.lastFrame.landmarks, LEFT_WRIST);
      const prevRight = getLandmark(this.lastFrame.landmarks, RIGHT_WRIST);
      if (prevLeft && prevRight) {
        const leftSpeed = distance(leftWrist, prevLeft) / dt;
        const rightSpeed = distance(rightWrist, prevRight) / dt;
        this.speedValues.push((leftSpeed + rightSpeed) / 2);
        this.speedValues = this.speedValues.slice(-40);
      }
    }

    const shoulderWidth = Math.max(distance(leftShoulder, rightShoulder), 0.03);
    const postureTilt = Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * (180 / Math.PI);
    const currentTilt = Math.abs(postureTilt);
    this.postureAngles.push(currentTilt);
    this.postureAngles = this.postureAngles.slice(-40);

    // Wrist-to-shoulder reach gives a simple proxy for reduced movement amplitude.
    const amplitude = mean([
      Math.max(0, leftShoulder.y - leftWrist.y),
      Math.max(0, rightShoulder.y - rightWrist.y),
    ]) / shoulderWidth;
    this.amplitudeRatios.push(amplitude);
    this.amplitudeRatios = this.amplitudeRatios.slice(-40);

    // Rapid direction changes with small displacement are treated as tremor-like jitter.
    const diffs = this.wristHistory.slice(1).map((sample, index) => ({
      dx: sample.x - this.wristHistory[index].x,
      dy: sample.y - this.wristHistory[index].y,
    }));

    // Only count significant flips (>0.012) to ignore camera noise and normal movement
    const significantDiffs = diffs.filter(d => Math.abs(d.dx) > 0.012 || Math.abs(d.dy) > 0.012);
    let signChanges = 0;
    for (let i = 1; i < significantDiffs.length; i++) {
      const diff = significantDiffs[i];
      const prev = significantDiffs[i - 1];
      const xFlip = Math.sign(diff.dx) !== 0 && Math.sign(prev.dx) !== 0 && Math.sign(diff.dx) !== Math.sign(prev.dx);
      const yFlip = Math.sign(diff.dy) !== 0 && Math.sign(prev.dy) !== 0 && Math.sign(diff.dy) !== Math.sign(prev.dy);
      if (xFlip || yFlip) signChanges++;
    }

    // Only penalize if jitter is actually in the human tremor range (0.02 to 0.10)
    const avgJitter = mean(diffs.map((diff) => Math.hypot(diff.dx, diff.dy)));
    const tremorScore = clampScore(signChanges * 3 + (avgJitter > 0.02 && avgJitter < 0.10 ? 15 : 0));

    // bradykinesiaScore = how much slowness (0 = normal speed, 100 = very slow)
    const avgSpeed = mean(this.speedValues);
    const bradykinesiaScore = clampScore(
      avgSpeed < 0.04 ? 100 : 
      avgSpeed < 0.07 ? 70 : 
      avgSpeed < 0.12 ? 40 : 
      avgSpeed < 0.18 ? 20 : 5
    );

    // postureScore = how much tilt/instability (0 = good posture, 100 = very tilted)
    const avgTilt = mean(this.postureAngles);
    const postureScore = clampScore(
      avgTilt > 18 ? (avgTilt - 5) * 2.5 :
      avgTilt > 12 ? (avgTilt - 12) * 4 :
      avgTilt > 6 ? (avgTilt - 6) * 3 : 0
    );

    // Amplitude = movement reach (0 = good amplitude, 100 = very reduced)
    const avgAmplitude = mean(this.amplitudeRatios);
    const amplitudeScore = clampScore(
      avgAmplitude < 0.1 ? 80 :
      avgAmplitude < 0.2 ? 50 :
      avgAmplitude < 0.3 ? 25 : 0
    );

    const overallComposite = tremorScore * 0.4 + bradykinesiaScore * 0.2 + postureScore * 0.2 + amplitudeScore * 0.2;
    const overallRisk = overallComposite >= 67 ? 'HIGH' : overallComposite >= 38 ? 'MEDIUM' : 'LOW';

    this.lastFrame = frame;

    return {
      tremorScore,
      bradykinesiaScore,
      postureScore,
      amplitudeScore,
      overallRisk,
      issues: {
        tremor: tremorScore >= 45,
        // Recalibrated speed threshold — in normalized coords small movements are typical
        speed: avgSpeed < 0.06 ? 'SLOW' : 'NORMAL',
        stability: currentTilt > 12 || avgTilt > 10 ? 'POOR' : 'GOOD',
        // Recalibrated amplitude threshold
        amplitude: avgAmplitude < 0.2 ? 'REDUCED' : 'ADEQUATE',
        noPerson: false,
        postureTiltDegrees: Number(currentTilt.toFixed(1)),
      },
    };
  }
}
