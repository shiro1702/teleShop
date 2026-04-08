export type ProductCategory = string

export interface ProductParameterOption {
  id: string
  name: string
  price?: number
  weightG?: number | null
  volumeMl?: number | null
  pieces?: number | null
  isDefault: boolean
  sortOrder: number
}

export interface ProductParameterGroup {
  id: string
  parameterKindId: string
  name: string
  isRequired: boolean
  options: ProductParameterOption[]
}

export interface ModifierOption {
  id: string
  name: string
  pricingType?: 'delta' | 'multiplier'
  priceDelta: number
  priceMultiplier?: number | null
  isDefault: boolean
}

export interface ModifierGroup {
  id: string
  name: string
  selectionType: 'single' | 'multi' | 'boolean'
  isRequired: boolean
  minSelect: number
  maxSelect: number | null
  options: ModifierOption[]
}

export interface Product {
  id: string
  name: string
  price: number
  image: string
  description?: string
  category: ProductCategory
  modifiers?: ModifierGroup[]
  parameters?: ProductParameterGroup[]
  availability?: {
    isOrderable: boolean
    reason: string | null
    deliveryRestrictedEffective?: boolean
    effectiveTimeWindows?: Array<{ days: number[]; start: string; end: string }>
  }
}

const SAMGYEPSAL_DESC =
  'Классическое корейское блюдо, которое представляет собой сочные ломтики мяса, которые вы сами жарите на гриле прямо за столом, в сочетании с разнообразными панчханами (корейскими закусками) и соусами.'

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Самгепсаль со свининой (сет на двоих)',
    price: 1600,
    image: '/menu/menu_r1_c1.webp',
    description: SAMGYEPSAL_DESC,
    category: 'Основные блюда',
  },
  {
    id: '2',
    name: 'Самгепсаль с говядиной (сет на двоих)',
    price: 1900,
    image: '/menu/menu_r1_c2.webp',
    description: SAMGYEPSAL_DESC,
    category: 'Основные блюда',
  },
  {
    id: '3',
    name: 'Говядина бульгоги',
    price: 720,
    image: '/menu/menu_r1_c3.webp',
    category: 'Основные блюда',
  },
  {
    id: '4',
    name: 'Яннём чикен',
    price: 450,
    image: '/menu/menu_r2_c1.webp',
    description:
      'Хрустящие кусочки курицы, покрытые глазурью из соуса, на выбор в сырном соусе и в кисло-сладком соусе',
    category: 'Основные блюда',
  },
  {
    id: '5',
    name: 'Токпокки',
    price: 590,
    image: '/menu/menu_r2_c2.webp',
    description:
      'Рисовые клёцки в остром соусе с отварным яйцом, блинчиком омук, под сыром моцарелла',
    category: 'Основные блюда',
  },
  {
    id: '6',
    name: 'Пибимпаб',
    price: 590,
    image: '/menu/menu_r2_c3.webp',
    description:
      'Рис, маринованная обжаренная говядина, шпинат, соевые ростки, обжаренный лук, острая морковь, зелёный лук, паста кочуджан, яйцо',
    category: 'Основные блюда',
  },
  {
    id: '7',
    name: 'Корн-доги',
    price: 310,
    image: '/menu/menu_r3_c1.webp',
    description:
      'Сырный (сосиска, моцарелла) и фри (сосиска, картофель фри, моцарелла)',
    category: 'Основные блюда',
  },
  {
    id: '8',
    name: 'Кимчи покым паб',
    price: 450,
    image: '/menu/menu_r3_c2.webp',
    description:
      'Рис со свининой и кимчи в соусе, глазуньей, сыром моцарелла и зеленью',
    category: 'Основные блюда',
  },
  {
    id: '9',
    name: 'Чапчхе',
    price: 400,
    image: '/menu/menu_r3_c3.webp',
    description: 'Фунчоза с говядиной и овощами',
    category: 'Основные блюда',
  },
  {
    id: '10',
    name: 'Чаджанмён',
    price: 690,
    image: '/menu/menu_r4_c1.webp',
    description: 'Лапша удон с говядиной и овощами в соусе гальби',
    category: 'Основные блюда',
  },
  // Закуски
  {
    id: '11',
    name: 'Эноки',
    price: 530,
    image: '/menu/menu_r4_c2.webp',
    description: 'В остром соусе и соусе пулькоги (неостром)',
    category: 'Закуски',
  },
  // Супы
  {
    id: '12',
    name: 'Кимчи рамён',
    price: 490,
    image: '/menu/menu_r4_c3.webp',
    category: 'Супы',
  },
  {
    id: '13',
    name: 'Кимчи тиге',
    price: 490,
    image: '/menu/menu_r5_c1.webp',
    category: 'Супы',
  },
  // Десерты
  {
    id: '14',
    name: 'Моти',
    price: 270,
    image: '/menu/menu_r5_c2.webp',
    category: 'Десерты',
  },
]
