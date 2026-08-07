/**
 * 별자리 배치 계산.
 *
 * 좌표와 연결선을 순수 함수로 만든다. Math.random 을 쓰지 않고 고정 시드
 * 난수를 쓰는 이유는, 요청마다 배치가 달라져 화면이 튀는 것을 막고 서버가
 * 만든 마크업과 클라이언트가 이어받는 마크업을 같게 유지하기 위해서다.
 */

/** 0~100 좌표계. 원점이 아니라 가운데(50,50)를 중심으로 삼는다. */
export type StarPoint = { x: number; y: number };

/** 두 별을 잇는 선 하나 */
export type StarEdge = { from: number; to: number };

export type Constellation = {
  points: StarPoint[];
  edges: StarEdge[];
};

/**
 * 이름표를 별에서 얼마나 아래로 내려 놓는지. 화면에서 쓰는 값과 맞춰야
 * 배치 계산이 실제와 어긋나지 않는다.
 */
export const LABEL_OFFSET_PERCENT = 6;

/** 황금각. 씨앗이 겹치지 않게 퍼지는 해바라기 배치에 쓰는 각도다. */
const GOLDEN_ANGLE_DEG = 137.50776405003785;

/**
 * 중심에서 가장 먼 별까지의 거리.
 *
 * 판이 회전하므로 별은 이 반지름의 원을 그린다. 이름표는 별보다 아래에 있고
 * 가로로 넓으므로, 별이 판 아래쪽에 왔을 때 이름표가 판을 벗어나지 않아야
 * 한다. MAX_RADIUS + 이름표 비켜놓기 + 이름표 높이 절반 <= 50 을 지킨다.
 */
const MAX_RADIUS = 40;

/** 가운데가 비어 보이지 않게 최소 거리를 준다. */
const MIN_RADIUS = 9;

/**
 * 이름표가 차지하는 자리. 0~100 좌표계 기준이다.
 *
 * 이름표는 픽셀 크기가 고정이고 좌표는 백분율이므로, 판이 작을수록 이름표가
 * 차지하는 비율이 커진다. 가장 빡빡한 경우인 모바일(판 약 324px)을 기준으로
 * 잡는다. 데스크톱에서는 같은 값이 여유롭게 작용한다.
 *
 * 이름 세 글자 기준 모바일에서 약 36x15px → 판(324px)의 11.1% x 4.6%.
 */
const LABEL_WIDTH = 11.5;
const LABEL_HEIGHT = 5.2;

/**
 * 별 중심에서 이름표 중심까지의 거리. CSS 의 top 값과 글자 높이 절반에 해당한다.
 *
 * 모든 이름표를 별 아래 같은 방향으로 둔다. 위아래로 번갈아 두면 위쪽 별의
 * 이름표가 내려오고 아래쪽 별의 이름표가 올라와 서로 만나면서, 별 사이 거리를
 * 벌려 놓은 효과가 상쇄된다. 방향을 통일하면 이름표 간 거리가 별 간 거리와
 * 같아져 아래 최소 거리 조건만으로 겹침을 막을 수 있다.
 */
const LABEL_LANE_OFFSET = LABEL_OFFSET_PERCENT;

/**
 * 두 별 사이에 필요한 최소 거리.
 *
 * 이름표의 대각선 길이로 잡는다. 판이 회전하면 두 이름표를 잇는 방향도 함께
 * 도는데, 이름표는 늘 수평을 유지하므로 어느 각도에서는 가로로 떨어져 있던
 * 쌍이 세로로 마주 선다. 세로로 필요한 여유는 가로보다 작으니, 어떤 각도에서도
 * 안전하려면 중심 거리가 가로·세로를 변으로 하는 직사각형의 대각선보다 커야
 * 한다. 이 조건은 회전과 무관하다.
 */
const MIN_SEPARATION = Math.hypot(LABEL_WIDTH, LABEL_HEIGHT) + 1;

/**
 * 이름표가 판 안에 머무는 반지름 상한.
 *
 * 별이 판 아래쪽에 왔을 때 이름표 아래 끝이 판 경계에 닿는 지점이다.
 * MAX_RADIUS 를 잘못 키워도 여기서 막히므로 이름표가 잘리지 않는다.
 */
const SAFE_RADIUS = Math.min(MAX_RADIUS, 50 - LABEL_LANE_OFFSET - LABEL_HEIGHT / 2);

/**
 * 밀어내기 반복 횟수.
 *
 * 겹침이 사라지면 도중에 멈춘다. 넉넉히 잡아도 22개 좌표 계산이라
 * 비용이 눈에 띄지 않는다.
 */
const RELAX_STEPS = 600;

/**
 * 이름 개수만큼 별을 흩고 선으로 잇는다.
 *
 * 배치는 해바라기(phyllotaxis) 나선으로 시작한다. 격자처럼 규칙적으로 보이지
 * 않고, 무작위 산포와 달리 뭉치거나 빈 곳이 생기지 않는다. 여기에 시드 난수로
 * 흔들림을 더해 나선 티를 없앤 뒤, 이름표가 겹치지 않을 때까지 서로 밀어낸다.
 */
export function buildConstellation(count: number): Constellation {
  if (count <= 0) {
    return { points: [], edges: [] };
  }

  const random = seededRandom(0x6e657762); // "newb"
  const points: StarPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    // sqrt 를 쓰면 넓이당 별 개수가 고르게 유지된다. 선형이면 가장자리가 성기다.
    const spread = Math.sqrt((i + 0.5) / count);
    const radius = MIN_RADIUS + (SAFE_RADIUS - MIN_RADIUS) * spread;
    const angle = ((i * GOLDEN_ANGLE_DEG) * Math.PI) / 180;

    // 나선 규칙성을 흐트러뜨리는 정도의 작은 흔들림
    const jitterRadius = radius + (random() - 0.5) * 3;
    const jitterAngle = angle + (random() - 0.5) * 0.16;

    points.push({
      x: 50 + jitterRadius * Math.cos(jitterAngle),
      y: 50 + jitterRadius * Math.sin(jitterAngle),
    });
  }

  relax(points);

  return {
    points: points.map((point) => ({ x: round(point.x), y: round(point.y) })),
    edges: buildEdges(points, random),
  };
}

/**
 * 너무 가까운 별들을 서로 밀어낸다.
 *
 * 최소 거리를 원형으로 잡는 이유는 판이 회전하기 때문이다. 사각형 기준으로
 * 밀어내면 특정 각도에서만 겹치는 쌍이 남는다. MIN_SEPARATION 주석 참고.
 *
 * 밀려난 별이 원 밖으로 나가면 다시 안으로 당긴다. 회전하는 판이라 반지름을
 * 넘기면 이름표가 화면에서 잘린다.
 */
function relax(points: StarPoint[]): void {
  for (let step = 0; step < RELAX_STEPS; step += 1) {
    let moved = false;

    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= MIN_SEPARATION) continue;

        moved = true;

        // 완전히 겹쳐 방향이 없으면 정해진 방향으로 떼어 놓는다.
        const ux = distance === 0 ? 1 : dx / distance;
        const uy = distance === 0 ? 0 : dy / distance;

        // 절반씩 나눠 밀되, 한 번에 다 밀지 않고 조금씩 수렴시킨다.
        const push = (MIN_SEPARATION - distance) * 0.5 * 0.5;

        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }

    // 원 안으로 되돌린다.
    points.forEach((point) => {
      const dx = point.x - 50;
      const dy = point.y - 50;
      const radius = Math.hypot(dx, dy);

      if (radius > SAFE_RADIUS) {
        const scale = SAFE_RADIUS / radius;
        point.x = 50 + dx * scale;
        point.y = 50 + dy * scale;
      }
    });

    // 더 이상 가까운 쌍이 없으면 일찍 끝낸다.
    if (!moved) break;
  }
}

/**
 * 연결선을 만든다.
 *
 * 가까운 별끼리 잇는 것을 기본으로 하고, 멀리 떨어진 별을 잇는 선을 몇 개
 * 섞는다. 가까운 것만 이으면 둘레를 따라가는 고리처럼 보이고, 전부 무작위로
 * 이으면 실뭉치가 된다. 22명이면 30~40개 선이 성좌처럼 읽힌다.
 *
 * 모든 별을 서로 잇지 않는다. 누가 누구와 아는지에 대한 자료가 없으므로
 * 선은 관계를 뜻하지 않고 배경 장식이다.
 */
function buildEdges(points: StarPoint[], random: () => number): StarEdge[] {
  const seen = new Set<string>();
  const edges: StarEdge[] = [];

  const add = (from: number, to: number) => {
    if (from === to) return;
    const key = from < to ? `${from}-${to}` : `${to}-${from}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };

  // 1) 각 별에서 가장 가까운 두 별로 선을 낸다.
  points.forEach((point, index) => {
    const nearest = points
      .map((other, otherIndex) => ({ otherIndex, distance: distance(point, other) }))
      .filter((entry) => entry.otherIndex !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);

    nearest.forEach((entry) => add(index, entry.otherIndex));
  });

  // 2) 화면을 가로지르는 긴 선을 몇 개 더한다. 성좌다운 인상을 준다.
  const longEdgeCount = Math.max(3, Math.round(points.length / 6));
  for (let i = 0; i < longEdgeCount; i += 1) {
    const from = Math.floor(random() * points.length);
    const to = Math.floor(random() * points.length);
    add(from, to);
  }

  return edges;
}

function distance(a: StarPoint, b: StarPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * mulberry32. 짧고 분포가 고른 고정 시드 난수다.
 * 같은 시드에서 항상 같은 순서를 내므로 배치가 재현된다.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
