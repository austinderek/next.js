import { useEffect } from 'react'
import {
  ACTION_RESTART_SERVER_BUTTON,
  type OverlayDispatch,
} from '../../../shared'
import type { SupportedErrorEvent } from '../../../container/runtime-error/render-error'

/**
 * Sets up a beforeunload listener to show the restart server button
 * if the developer reloads on a specific error and that error persists with Turbopack + Persistent Cache.
 */
export function usePersistentCacheErrorDetection({
  errors,
  dispatch,
}: {
  errors: SupportedErrorEvent[]
  dispatch: OverlayDispatch
}) {
  useEffect(() => {
    const isTurbopackWithCache =
      process.env.__NEXT_BUNDLER?.toUpperCase() === 'TURBOPACK' &&
      process.env.__NEXT_BUNDLER_HAS_PERSISTENT_CACHE
    // TODO: Is there a better heuristic here?
    const firstError = errors[0]?.error

    if (isTurbopackWithCache && firstError) {
      const errorKey = `__next_error_overlay:${window.location.pathname}:${firstError.message}`
      const showRestartServerButton = sessionStorage.getItem(errorKey) === '1'

      dispatch({
        type: ACTION_RESTART_SERVER_BUTTON,
        showRestartServerButton,
      })

      const handleBeforeUnload = () => {
        sessionStorage.setItem(errorKey, '1')
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    } else {
      dispatch({
        type: ACTION_RESTART_SERVER_BUTTON,
        showRestartServerButton: false,
      })
    }
  }, [errors, dispatch])
}
