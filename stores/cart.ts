import { defineStore } from 'pinia'

export type ProductCategory = 'main' | 'закуски' | 'супы' | 'десерты'

export interface Product {
  id: string
  name: string
  price: number
  image: string
  description?: string
  category: ProductCategory
}

export interface CartItem extends Product {
  quantity: number
}

const SAMGYEPSAL_DESC =
  'Классическое корейское блюдо, которое представляет собой сочные ломтики мяса, которые вы сами жарите на гриле прямо за столом, в сочетании с разнообразными панчханами (корейскими закусками) и соусами. Это одно из самых популярных и любимых блюд в Корее, которое символизирует корейское гостеприимство, традиции и любовь к хорошей еде. Приготовление самгепсаля объединяет за столом семью и друзей, создавая атмосферу теплой трапезы.'

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Самгепсаль со свининой (сет на двоих)',
    price: 1600,
    image: 'https://placehold.co/400x400/fef2f2/dc2626?text=Самгепсаль',
    description: SAMGYEPSAL_DESC,
    category: 'main',
  },
  {
    id: '2',
    name: 'Самгепсаль с говядиной (сет на двоих)',
    price: 1900,
    image: 'https://placehold.co/400x400/fef2f2/dc2626?text=Самгепсаль',
    description: SAMGYEPSAL_DESC,
    category: 'main',
  },
  {
    id: '3',
    name: 'Говядина бульгоги',
    price: 720,
    image: 'https://placehold.co/400x400/ffedd5/ea580c?text=Бульгоги',
    category: 'main',
  },
  {
    id: '4',
    name: 'Яннём чикен',
    price: 450,
    image: 'https://placehold.co/400x400/fef9c3/ca8a04?text=Яннём',
    description:
      'Хрустящие кусочки курицы, покрытые глазурью из соуса, на выбор в сырном соусе и в кисло-сладком соусе',
    category: 'main',
  },
  {
    id: '5',
    name: 'Токпокки',
    price: 590,
    image: 'https://placehold.co/400x400/fee2e2/b91c1c?text=Токпокки',
    description:
      'Рисовые клёцки в остром соусе с отварным яйцом, блинчиком омук, под сыром моцарелла',
    category: 'main',
  },
  {
    id: '6',
    name: 'Пибимпаб',
    price: 590,
    image: 'https://placehold.co/400x400/dcfce7/15803d?text=Пибимпаб',
    description:
      'Рис, маринованная обжаренная говядина, шпинат, соевые ростки, обжаренный лук, острая морковь, зелёный лук, паста кочуджан, яйцо',
    category: 'main',
  },
  {
    id: '7',
    name: 'Корн-доги',
    price: 310,
    image: 'https://placehold.co/400x400/fef3c7/d97706?text=Корн-доги',
    description:
      'Сырный (сосиска, моцарелла) и фри (сосиска, картофель фри, моцарелла)',
    category: 'main',
  },
  {
    id: '8',
    name: 'Кимчи покым паб',
    price: 450,
    image: 'https://placehold.co/400x400/fed7aa/c2410c?text=Кимчи+паб',
    description:
      'Рис со свининой и кимчи в соусе, глазуньей, сыром моцарелла и зеленью',
    category: 'main',
  },
  {
    id: '9',
    name: 'Чапчхе',
    price: 400,
    image: 'https://placehold.co/400x400/e0e7ff/4338ca?text=Чапчхе',
    description: 'Фунчоза с говядиной и овощами',
    category: 'main',
  },
  {
    id: '10',
    name: 'Чаджанмён',
    price: 690,
    image: 'https://placehold.co/400x400/fce7f3/be185d?text=Чаджанмён',
    description: 'Лапша удон с говядиной и овощами в соусе гальби',
    category: 'main',
  },
  // Закуски
  {
    id: '11',
    name: 'Эноки',
    price: 530,
    image: 'https://placehold.co/400x400/d1fae5/047857?text=Эноки',
    description:
      'В остром соусе и соусе пулькоги (неостром)',
    category: 'закуски',
  },
  // Супы
  {
    id: '12',
    name: 'Кимчи рамён',
    price: 490,
    image: 'https://placehold.co/400x400/ffedd5/ea580c?text=Кимчи+рамён',
    category: 'супы',
  },
  {
    id: '13',
    name: 'Кимчи тиге',
    price: 490,
    image: 'https://placehold.co/400x400/ffedd5/ea580c?text=Кимчи+тиге',
    category: 'супы',
  },
  // Десерты
  {
    id: '14',
    name: 'Моти',
    price: 270,
    image: 'https://placehold.co/400x400/fae8ff/a21caf?text=Моти',
    category: 'десерты',
  },
]

const CATEGORY_ORDER: ProductCategory[] = ['main', 'закуски', 'супы', 'десерты']
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  main: 'Основные блюда',
  закуски: 'Закуски',
  супы: 'Супы',
  десерты: 'Десерты',
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    products: MOCK_PRODUCTS,
    items: [] as CartItem[],
  }),
  getters: {
    total: (state) =>
      state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    count: (state) =>
      state.items.reduce((sum, item) => sum + item.quantity, 0),
    quantityById: (state) => (productId: string) =>
      state.items.find((i) => i.id === productId)?.quantity ?? 0,
    productsByCategory(): { category: ProductCategory; label: string; products: Product[] }[] {
      return CATEGORY_ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        products: this.products.filter((p) => p.category === category),
      })).filter((section) => section.products.length > 0)
    },
  },
  actions: {
    addItem(product: Product, quantity = 1) {
      const existing = this.items.find((i) => i.id === product.id)
      if (existing) {
        existing.quantity += quantity
      } else {
        this.items.push({ ...product, quantity })
      }
    },
    removeItem(id: string) {
      this.items = this.items.filter((i) => i.id !== id)
    },
    updateQuantity(id: string, quantity: number) {
      const item = this.items.find((i) => i.id === id)
      if (item) {
        if (quantity <= 0) this.removeItem(id)
        else item.quantity = quantity
      }
    },
    clear() {
      this.items = []
    },
  },
})
