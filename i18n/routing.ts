import { defineRouting } from 'next-intl/routing'
import { createNavigation } from 'next-intl/navigation'

export const routing = defineRouting({
  locales: ['ko', 'en', 'ja'] as const,
  defaultLocale: 'ko',
  // 기본 로케일은 URL prefix 없이 (ko → '/') 노출
  localePrefix: 'as-needed',
})

export type Locale = (typeof routing.locales)[number]

// Link·redirect·usePathname·useRouter 의 로케일 인식 버전
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
