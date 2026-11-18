export const productionSteps = [
  {
    slug: 'sanding',
    category: '사포질',
    image: 'process-sanding-closeup.webp',
    label: '01 / SANDING',
    title: '사포질',
    description: '작은 비즈의 표면을 손끝으로 다듬는 시간.',
    alt: '사포 위에서 작은 비즈의 표면을 손으로 다듬는 모습',
    body: [
      '작은 비즈를 손으로 잡고 사포 위에서 표면을 다듬습니다. 손끝으로 위치를 잡아가며 비즈의 면을 정리하는 과정을 남겼습니다.',
      '완성된 장신구에서는 잘 보이지 않는 준비의 순간입니다. 비즈 한 알을 가까이 들여다보며 형태를 다듬는 손의 움직임을 기록했습니다.',
    ],
  },
  {
    slug: 'coating',
    category: '도포',
    image: 'process-bead-coating.webp',
    label: '02 / COATING',
    title: '광변색 염료 도포',
    description: '광변색 염료와 UV 용액을 섞어 바릅니다.',
    alt: '광변색 염료와 UV 용액을 섞은 재료를 붓으로 비즈에 도포하는 모습',
    body: [
      '광변색 염료와 UV 용액을 섞은 뒤 붓으로 비즈 표면에 도포합니다. 붓이 비즈에 닿는 순간과 손의 움직임을 가까이에서 담았습니다.',
      '재료와 도구, 그리고 비즈를 잡은 손을 한 장면에 담았습니다. 작은 면을 따라 붓을 움직이는 과정도 SUNNY가 남기는 제작의 기록입니다.',
    ],
  },
  {
    slug: 'uv-light',
    category: '경화',
    image: 'process-uv-flashlight.webp',
    label: '03 / UV CURING',
    title: 'UV 경화',
    description: 'UV 빛을 비춰 비즈 표면에 도포한 재료를 경화합니다.',
    alt: 'UV 빛으로 비즈 표면의 도포 재료를 경화하는 모습',
    body: [
      '도포를 마친 비즈에 UV 빛을 비춰 경화합니다. 작업대 위 비즈와 경화에 사용하는 도구를 함께 담았습니다.',
      '비즈 표면에 도포한 재료를 굳히며 다음 조립 단계를 준비합니다. 빛을 이용해 마무리하는 제작의 순간을 기록했습니다.',
    ],
  },
  {
    slug: 'threading',
    category: '줄꿰기',
    image: 'process-threading.webp',
    label: '04 / THREADING',
    title: '줄꿰기',
    description: '네모 하나, 원 하나. 한 알씩 이어지는 형태.',
    alt: '네모 비즈와 원형 비즈를 줄에 꿰어 연결하는 모습',
    body: [
      '줄에 네모 비즈와 원형 비즈를 꿰어 연결합니다. 한 알씩 위치를 맞추며 비즈가 하나의 장신구로 이어지는 과정을 기록했습니다.',
      '손 안의 작은 조각들이 줄을 따라 나란히 놓입니다. 비즈를 다듬고 도포하던 시간은 이렇게 몸 가까이 지닐 수 있는 형태로 이어집니다.',
    ],
  },
];

export type ProductionStep = (typeof productionSteps)[number];
