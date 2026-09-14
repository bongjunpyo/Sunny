// 팔찌 원 둘레에 사각 비즈와 동그란 스페이서를 번갈아 배치할 좌표
export interface Slot {
  angle: number;
  x: number;
  y: number;
  z: number;
}

export function braceletSlots(count: number, radius: number): { beads: Slot[]; spacers: Slot[] } {
  const beads: Slot[] = [];
  const spacers: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = a + Math.PI / count; // 비즈 사이 한가운데
    beads.push({ angle: a, x: Math.cos(a) * radius, y: 0, z: Math.sin(a) * radius });
    spacers.push({ angle: b, x: Math.cos(b) * radius, y: 0, z: Math.sin(b) * radius });
  }
  return { beads, spacers };
}

// 비즈 앞면(+Z)이 원 바깥쪽을 보게 하는 Y축 회전값
export const faceOutward = (angle: number) => Math.PI / 2 - angle;
