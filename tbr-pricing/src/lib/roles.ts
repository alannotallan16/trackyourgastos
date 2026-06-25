import type { AppConfig, Role } from '../config/types'

/** Group roles by category, preserving config order. */
export function groupRoles(config: AppConfig): { category: string; roles: Role[] }[] {
  const groups: { category: string; roles: Role[] }[] = []
  for (const role of config.roles) {
    let g = groups.find((x) => x.category === role.category)
    if (!g) {
      g = { category: role.category, roles: [] }
      groups.push(g)
    }
    g.roles.push(role)
  }
  return groups
}

export function findRole(config: AppConfig, roleName: string): Role | undefined {
  return config.roles.find((r) => r.role === roleName)
}
