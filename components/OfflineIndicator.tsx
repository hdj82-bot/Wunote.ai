'use client'

import { useEffect, useState } from 'react'

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)

    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      오프라인
    </div>
  )
}
