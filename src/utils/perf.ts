/**
 * `?lite` in the URL disables shadows, post-processing and high DPR. Used by
 * the headless playthrough harness and handy on low-end machines.
 */
export const LITE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lite')
