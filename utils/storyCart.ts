import type { Product, ModifierGroup, ModifierOption, ProductParameterGroup } from '~/data/products'
import type { SelectedModifier, SelectedParameter } from '~/stores/cart'

export function buildDefaultCartSelections(product: Product): {
  modifiers: SelectedModifier[]
  parameters: SelectedParameter[]
} {
  const modifiers: SelectedModifier[] = []
  const parameters: SelectedParameter[] = []

  if (product.parameters) {
    for (const group of product.parameters) {
      const defaultOpt =
        group.options.find((o) => o.isDefault) || group.options[0]
      if (!defaultOpt) continue
      parameters.push({
        parameterKindId: group.parameterKindId,
        productParameterId: group.id,
        optionId: defaultOpt.id,
        optionName: defaultOpt.name,
        price: defaultOpt.price ?? 0,
        weightG: defaultOpt.weightG,
        volumeMl: defaultOpt.volumeMl,
        pieces: defaultOpt.pieces,
      })
    }
  }

  if (product.modifiers) {
    for (const group of product.modifiers) {
      const selected = pickDefaultModifierOptions(group)
      for (const opt of selected) {
        modifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          pricingType: opt.pricingType || 'delta',
          priceDelta: opt.priceDelta,
          priceMultiplier: opt.priceMultiplier ?? null,
        })
      }
    }
  }

  return { modifiers, parameters }
}

function pickDefaultModifierOptions(group: ModifierGroup): ModifierOption[] {
  const defaults = group.options.filter((o) => o.isDefault)
  if (defaults.length) return defaults

  if (group.isRequired && group.minSelect > 0) {
    const n = Math.min(group.minSelect, group.options.length)
    return group.options.slice(0, n)
  }

  if (group.selectionType === 'multi' || group.selectionType === 'boolean') {
    return []
  }

  return group.options[0] ? [group.options[0]] : []
}

export function findProductById(products: Product[], id: string): Product | null {
  return products.find((p) => p.id === id) ?? null
}
